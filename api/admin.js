const crypto = require('crypto');
const passwordHash = require('./_lib/password-hash');
const auth = require('./_lib/auth');
const github = require('./_lib/github');
const articles = require('./_lib/article');

const DRAFTS_DIR = 'content/drafts';
const DRAFT_ID = /^[a-f0-9]{32}$/;

class RequestError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function draftPath(id) {
    return `${DRAFTS_DIR}/${id}.json.enc`;
}

function requireDraftId(id) {
    if (!DRAFT_ID.test(String(id))) throw new RequestError(400, 'Invalid draft id.');
    return id;
}

async function listDrafts() {
    const head = await github.getHead();
    const entries = await github.listDirectory(DRAFTS_DIR, head.sha);
    const files = entries.filter((entry) => entry.type === 'file' && entry.name.endsWith('.json.enc'));

    const drafts = await Promise.all(files.map(async (entry) => {
        const id = entry.name.replace('.json.enc', '');
        if (!DRAFT_ID.test(id)) return null;
        const payload = await github.getFile(entry.path, head.sha);
        return payload ? { id, ...auth.decryptDraft(id, payload) } : null;
    }));

    return drafts
        .filter(Boolean)
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

async function saveDraft(body) {
    const id = body.id ? requireDraftId(body.id) : crypto.randomBytes(16).toString('hex');
    const updatedAt = new Date().toISOString();
    const draft = { article: articles.normalizeArticle(body.article), updatedAt };

    const head = await github.getHead();
    // The message stays generic because the repository may be public.
    await github.commitFiles(head, 'chore: Update encrypted blog draft', {
        [draftPath(id)]: auth.encryptDraft(id, draft),
    });
    return { id, updatedAt };
}

async function publish(body) {
    const article = articles.normalizeArticle(body.article);
    const missing = articles.validateForPublish(article);
    if (missing.length) throw new RequestError(400, `Missing or invalid: ${missing.join(', ')}.`);

    const head = await github.getHead();
    const articlePath = `blog/${article.slug}/index.html`;
    if (await github.getFile(articlePath, head.sha)) {
        throw new RequestError(409, `An article already exists at /blog/${article.slug}. Choose another slug.`);
    }

    const blogIndex = await github.getFile('blog/index.html', head.sha);
    if (!blogIndex) throw new Error('blog/index.html not found');

    const date = articles.publicationDate();
    const files = {
        [articlePath]: articles.buildArticlePage(article, date),
        'blog/index.html': articles.addToBlogIndex(blogIndex, article, date),
    };

    if (body.id) {
        const id = requireDraftId(body.id);
        if (await github.getFile(draftPath(id), head.sha)) files[draftPath(id)] = null;
    }

    await github.commitFiles(head, `feat: Publish article ${article.slug}`, files);
    return { url: `/blog/${article.slug}/index.html` };
}

async function handle(req, res, body) {
    if (body.action === 'login') {
        if (!passwordHash) throw new RequestError(503, 'No password is configured yet.');
        if (!(await auth.verifyPassword(body.password, passwordHash))) {
            throw new RequestError(401, 'Wrong password.');
        }
        res.setHeader('Set-Cookie', auth.createSessionCookie());
        return { ok: true };
    }

    if (!auth.isAuthenticated(req)) throw new RequestError(401, 'Please log in.');

    switch (body.action) {
        case 'session':
            return { ok: true };
        case 'logout':
            res.setHeader('Set-Cookie', auth.clearSessionCookie());
            return { ok: true };
        case 'listDrafts':
            return { drafts: await listDrafts() };
        case 'saveDraft':
            return saveDraft(body);
        case 'publish':
            return publish(body);
        default:
            throw new RequestError(400, 'Unknown action.');
    }
}

module.exports = async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex');

    try {
        if (req.method !== 'POST') throw new RequestError(405, 'Method not allowed.');
        if (!String(req.headers['content-type'] || '').startsWith('application/json')) {
            throw new RequestError(415, 'Expected JSON.');
        }
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        res.status(200).json(await handle(req, res, body));
    } catch (error) {
        if (error instanceof RequestError) {
            res.status(error.status).json({ error: error.message });
            return;
        }
        console.error('Blog admin error:', error.message);
        const conflict = error.status === 409 || error.status === 422;
        res.status(conflict ? 409 : 500).json({
            error: conflict
                ? 'The repository changed while saving. Try again.'
                : 'Server error. Check the Vercel function logs.',
        });
    }
};
