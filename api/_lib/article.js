const { renderMarkdown, escapeHtml } = require('../../assets/js/markdown.js');

const LANGS = ['en', 'es'];
const TIME_ZONE = 'America/Guayaquil';
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED_SLUGS = ['admin'];
const LIST_MARKER = '<ul class="post-list">';
const MONTHS = {
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
};
const COPY = {
    en: { back: 'All articles', minute: 'minute', minutes: 'minutes' },
    es: { back: 'Todos los artículos', minute: 'minuto', minutes: 'minutos' },
};

function text(value) {
    return typeof value === 'string' ? value : '';
}

function normalizeArticle(input) {
    const source = input && typeof input === 'object' ? input : {};
    const article = { slug: text(source.slug).trim() };
    for (const lang of LANGS) {
        const fields = source[lang] && typeof source[lang] === 'object' ? source[lang] : {};
        article[lang] = {
            title: text(fields.title).trim(),
            excerpt: text(fields.excerpt).trim(),
            body: text(fields.body),
        };
    }
    return article;
}

function validateForPublish(article) {
    const missing = [];
    if (!SLUG.test(article.slug)) missing.push('a valid URL slug (lowercase letters, numbers and hyphens)');
    if (RESERVED_SLUGS.includes(article.slug)) missing.push('a slug other than "admin"');
    for (const lang of LANGS) {
        for (const field of ['title', 'excerpt', 'body']) {
            if (!article[lang][field].trim()) missing.push(`${lang.toUpperCase()} ${field}`);
        }
    }
    return missing;
}

function publicationDate(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(now);
    const get = (type) => Number(parts.find((part) => part.type === type).value);
    const year = get('year');
    const month = get('month');
    const day = get('day');
    return {
        iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        en: `${MONTHS.en[month - 1]} ${day}, ${year}`,
        es: `${day} ${MONTHS.es[month - 1]} ${year}`,
    };
}

function readingTime(body, lang) {
    const words = body.trim().split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.round(words / 200));
    return `${minutes} ${minutes === 1 ? COPY[lang].minute : COPY[lang].minutes}`;
}

function meta(article, lang, date) {
    return `<time datetime="${date.iso}">${date[lang]}</time> · ${readingTime(article[lang].body, lang)}`;
}

function articleBlock(article, lang, date) {
    const fields = article[lang];
    return `    <article data-lang="${lang}" lang="${lang}">
        <header class="article-header">
            <div class="blog-container">
                <a class="back-link" href="/blog/index.html">&larr; ${COPY[lang].back}</a>
                <p class="post-meta">${meta(article, lang, date)}</p>
                <h1>${escapeHtml(fields.title)}</h1>
                <p class="section-text-m">${escapeHtml(fields.excerpt)}</p>
            </div>
        </header>

        <div class="article-body">
            <div class="blog-container">
${renderMarkdown(fields.body)}
            </div>
        </div>
    </article>`;
}

function buildArticlePage(article, date) {
    const pageTitle = `${article.en.title} - Dani3`;
    // Safe inside <script>: "<" cannot close the tag once escaped.
    const translations = JSON.stringify({
        'article.pageTitle': escapeHtml(`${article.es.title} - Dani3`),
        'article.description': article.es.excerpt,
    }).replace(/</g, '\\u003c');

    return `<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script>window.I18N_EXTRA = ${translations};</script>
    <script src="/assets/js/i18n.js"></script>
    <meta name="description" content="${escapeHtml(article.en.excerpt)}" data-i18n-attr="content:article.description">
    <title data-i18n="article.pageTitle">${escapeHtml(pageTitle)}</title>
    <link rel="icon" href="/favicon.ico">
    <link rel="stylesheet" href="/assets/vendor/bootstrap/css/bootstrap.min.css">
    <link rel="stylesheet" href="/assets/css/layout.css">
    <link rel="stylesheet" href="/assets/css/index.css">
    <link rel="stylesheet" href="/assets/css/cursor.css">
    <link rel="stylesheet" href="/assets/css/blog.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Lora&family=Poppins:wght@300;500;700&display=swap" rel="stylesheet">
</head>

<body class="blog">
    <div class="cursor"></div>

    <div class="navbar sticky-top justify-content-between">
        <a href="/" class="navbar-brand">
            <img src="/assets/img/patacon_dani.jpeg" alt="logo" class="logo">
        </a>
        <div class="nav-actions">
            <div class="lang-switch" role="group" aria-label="Language" data-i18n-attr="aria-label:common.languageLabel">
                <button type="button" data-set-lang="en" lang="en" aria-label="English">EN</button>
                <button type="button" data-set-lang="es" lang="es" aria-label="Español">ES</button>
            </div>
            <a href="/blog/index.html">Blog</a>
        </div>
    </div>

${articleBlock(article, 'en', date)}

${articleBlock(article, 'es', date)}

    <div class="article-footer">
        <a class="btn btn-bw" href="/blog/index.html" data-i18n="post.back">&larr; Back</a>
    </div>

    <section class="footer" data-i18n="common.footer">
        Site designed and built by me.
    </section>

    <script src="/assets/js/cursor.js"></script>
</body>

</html>
`;
}

function listEntry(article, lang, date) {
    const fields = article[lang];
    return `                    <a class="post-link" data-lang="${lang}" lang="${lang}" href="/blog/${article.slug}/index.html">
                        <p class="post-meta">${meta(article, lang, date)}</p>
                        <h2 class="post-title">${escapeHtml(fields.title)}</h2>
                        <p class="post-excerpt">${escapeHtml(fields.excerpt)}</p>
                    </a>`;
}

function addToBlogIndex(indexHtml, article, date) {
    const position = indexHtml.indexOf(LIST_MARKER);
    if (position === -1) throw new Error('Article list not found in blog/index.html');

    const insertAt = position + LIST_MARKER.length;
    const item = `
                <li>
${listEntry(article, 'en', date)}
${listEntry(article, 'es', date)}
                </li>`;
    return indexHtml.slice(0, insertAt) + item + indexHtml.slice(insertAt);
}

module.exports = {
    normalizeArticle,
    validateForPublish,
    publicationDate,
    buildArticlePage,
    addToBlogIndex,
};
