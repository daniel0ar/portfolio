const REPO = 'daniel0ar/portfolio';
const BRANCH = 'main';
const API = `https://api.github.com/repos/${REPO}`;

async function request(path, options = {}) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error('GITHUB_TOKEN is not set');

    const { accept, ...fetchOptions } = options;
    const response = await fetch(`${API}${path}`, {
        ...fetchOptions,
        headers: {
            Accept: accept || 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'blog-admin',
            'X-GitHub-Api-Version': '2022-11-28',
        },
    });

    if (response.status === 404) return null;
    if (!response.ok) {
        const error = new Error(`GitHub ${response.status} on ${path}`);
        error.status = response.status;
        throw error;
    }
    return accept ? response.text() : response.json();
}

function encodePath(path) {
    return path.split('/').map(encodeURIComponent).join('/');
}

async function getHead() {
    const ref = await request(`/git/ref/heads/${BRANCH}`);
    if (!ref) throw new Error(`Branch ${BRANCH} not found`);
    const commit = await request(`/git/commits/${ref.object.sha}`);
    return { sha: ref.object.sha, tree: commit.tree.sha };
}

function getFile(path, sha) {
    return request(`/contents/${encodePath(path)}?ref=${sha}`, { accept: 'application/vnd.github.raw+json' });
}

async function listDirectory(path, sha) {
    const entries = await request(`/contents/${encodePath(path)}?ref=${sha}`);
    return Array.isArray(entries) ? entries : [];
}

// Applies all changes in one commit. A null value deletes the file.
async function commitFiles(head, message, files) {
    const tree = await request('/git/trees', {
        method: 'POST',
        body: JSON.stringify({
            base_tree: head.tree,
            tree: Object.entries(files).map(([path, content]) => (
                content === null
                    ? { path, mode: '100644', type: 'blob', sha: null }
                    : { path, mode: '100644', type: 'blob', content }
            )),
        }),
    });
    const commit = await request('/git/commits', {
        method: 'POST',
        body: JSON.stringify({ message, tree: tree.sha, parents: [head.sha] }),
    });
    await request(`/git/refs/heads/${BRANCH}`, {
        method: 'PATCH',
        body: JSON.stringify({ sha: commit.sha, force: false }),
    });
    return commit.sha;
}

module.exports = { getHead, getFile, listDirectory, commitFiles };
