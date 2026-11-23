(function () {
    var LANGS = ['es', 'en'];
    var FIELDS = ['title', 'excerpt', 'body'];

    var loginForm = document.getElementById('login');
    var loginError = document.getElementById('login-error');
    var app = document.getElementById('app');
    var editor = document.getElementById('editor');
    var slugInput = document.getElementById('slug');
    var statusEl = document.getElementById('status');
    var draftsEl = document.getElementById('drafts');
    var draftsEmpty = document.getElementById('drafts-empty');
    var actionButtons = [document.getElementById('save-draft'), document.getElementById('publish')];

    var drafts = [];
    var currentDraftId = null;
    var slugEdited = false;
    var dirty = false;
    var busy = false;

    function api(action, data) {
        return fetch('/api/admin', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.assign({ action: action }, data)),
        }).then(function (response) {
            return response.json().catch(function () { return {}; }).then(function (result) {
                if (!response.ok) {
                    var error = new Error(result.error || 'Request failed.');
                    error.status = response.status;
                    throw error;
                }
                return result;
            });
        });
    }

    function field(lang, name) {
        return document.getElementById(lang + '-' + name);
    }

    function setStatus(message) {
        statusEl.textContent = message;
    }

    function setBusy(value) {
        busy = value;
        actionButtons.forEach(function (button) { button.disabled = value; });
        draftsEl.querySelectorAll('button').forEach(function (button) { button.disabled = value; });
    }

    function slugify(value) {
        return value
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    function readArticle() {
        var article = { slug: slugInput.value.trim() };
        LANGS.forEach(function (lang) {
            article[lang] = {};
            FIELDS.forEach(function (name) { article[lang][name] = field(lang, name).value; });
        });
        return article;
    }

    function closePreviews() {
        document.querySelectorAll('[data-editor-lang]').forEach(function (group) {
            group.querySelector('textarea').hidden = false;
            group.querySelector('[data-preview]').hidden = true;
            group.querySelector('[data-preview-toggle]').textContent = 'Preview';
        });
    }

    function fillEditor(article, draftId) {
        var source = article || {};
        slugInput.value = source.slug || '';
        LANGS.forEach(function (lang) {
            FIELDS.forEach(function (name) {
                field(lang, name).value = (source[lang] && source[lang][name]) || '';
            });
        });
        currentDraftId = draftId || null;
        slugEdited = !!source.slug;
        dirty = false;
        closePreviews();
    }

    function confirmDiscard() {
        return !dirty || window.confirm('Discard your unsaved changes?');
    }

    function draftLabel(draft) {
        var article = draft.article || {};
        return (article.es && article.es.title) || (article.en && article.en.title) || 'Untitled draft';
    }

    function renderDrafts() {
        draftsEl.textContent = '';
        draftsEmpty.hidden = drafts.length > 0;

        drafts.forEach(function (draft) {
            var item = document.createElement('li');
            var info = document.createElement('div');
            var title = document.createElement('span');
            var date = document.createElement('span');
            var actions = document.createElement('div');
            var review = document.createElement('button');
            var publish = document.createElement('button');

            title.className = 'admin-draft-title';
            title.textContent = draftLabel(draft);
            date.className = 'admin-draft-date';
            date.textContent = 'Updated ' + new Date(draft.updatedAt).toLocaleString();
            info.append(title, date);

            review.type = 'button';
            review.className = 'admin-link';
            review.textContent = 'Review';
            review.addEventListener('click', function () {
                if (!confirmDiscard()) return;
                fillEditor(draft.article, draft.id);
                setStatus('Reviewing draft: ' + draftLabel(draft));
                editor.scrollIntoView({ behavior: 'smooth' });
            });

            publish.type = 'button';
            publish.className = 'admin-link';
            publish.textContent = 'Publish';
            publish.addEventListener('click', function () {
                if (!window.confirm('Publish "' + draftLabel(draft) + '"?')) return;
                publishArticle(draft.article, draft.id);
            });

            actions.append(review, publish);
            item.append(info, actions);
            draftsEl.append(item);
        });
    }

    function loadDrafts() {
        return api('listDrafts').then(function (result) {
            drafts = result.drafts;
            renderDrafts();
        });
    }

    function handleError(error) {
        if (error.status === 401) {
            showLogin('Your session expired. Log in again. Unsaved text is still in this tab.');
            return;
        }
        setStatus(error.message);
    }

    function saveDraft() {
        if (busy) return;
        setBusy(true);
        setStatus('Saving draft…');
        api('saveDraft', { id: currentDraftId, article: readArticle() })
            .then(function (result) {
                currentDraftId = result.id;
                dirty = false;
                return loadDrafts();
            })
            .then(function () { setStatus('Draft saved.'); })
            .catch(handleError)
            .finally(function () { setBusy(false); });
    }

    function publishArticle(article, draftId) {
        if (busy) return;
        setBusy(true);
        setStatus('Publishing…');
        api('publish', { id: draftId, article: article })
            .then(function (result) {
                if (draftId === currentDraftId) fillEditor(null, null);
                setStatus('');
                statusEl.append('Published. It will be live after the Vercel deploy: ');
                var link = document.createElement('a');
                link.href = result.url;
                link.textContent = result.url;
                statusEl.append(link);
                return loadDrafts();
            })
            .catch(handleError)
            .finally(function () { setBusy(false); });
    }

    function showLogin(message) {
        app.hidden = true;
        loginForm.hidden = false;
        loginError.textContent = message || '';
        document.getElementById('password').value = '';
        document.getElementById('password').focus();
    }

    function showApp() {
        loginForm.hidden = true;
        app.hidden = false;
        loadDrafts().catch(handleError);
    }

    loginForm.addEventListener('submit', function (event) {
        event.preventDefault();
        var button = loginForm.querySelector('button');
        button.disabled = true;
        loginError.textContent = '';
        api('login', { password: document.getElementById('password').value })
            .then(function () {
                document.getElementById('password').value = '';
                showApp();
            })
            .catch(function (error) { loginError.textContent = error.message; })
            .finally(function () { button.disabled = false; });
    });

    editor.addEventListener('input', function (event) {
        dirty = true;
        if (event.target === slugInput) slugEdited = !!slugInput.value;
        if (event.target === field('es', 'title') && !slugEdited) {
            slugInput.value = slugify(event.target.value);
        }
    });

    editor.addEventListener('submit', function (event) {
        event.preventDefault();
        publishArticle(readArticle(), currentDraftId);
    });

    document.getElementById('save-draft').addEventListener('click', saveDraft);

    document.querySelectorAll('[data-preview-toggle]').forEach(function (button) {
        button.addEventListener('click', function () {
            var group = button.closest('[data-editor-lang]');
            var textarea = group.querySelector('textarea');
            var preview = group.querySelector('[data-preview]');
            var showPreview = preview.hidden;
            // renderMarkdown escapes raw HTML and rejects unsafe link schemes.
            if (showPreview) preview.innerHTML = window.renderMarkdown(textarea.value);
            preview.hidden = !showPreview;
            textarea.hidden = showPreview;
            button.textContent = showPreview ? 'Edit' : 'Preview';
        });
    });

    document.getElementById('new-article').addEventListener('click', function () {
        if (!confirmDiscard()) return;
        fillEditor(null, null);
        setStatus('');
    });

    document.getElementById('logout').addEventListener('click', function () {
        if (!confirmDiscard()) return;
        api('logout').catch(function () {}).finally(function () {
            fillEditor(null, null);
            showLogin();
        });
    });

    window.addEventListener('beforeunload', function (event) {
        if (!dirty) return;
        event.preventDefault();
        event.returnValue = '';
    });

    api('session').then(showApp).catch(function () { showLogin(); });
})();
