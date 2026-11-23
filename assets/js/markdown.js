/**
 * Small Markdown renderer shared by the admin preview and the publishing API.
 *
 * Supports headings, paragraphs, bold, italics, strikethrough, links, images,
 * inline code, fenced code, blockquotes, nested lists and horizontal rules.
 * Raw HTML is escaped, and links with unsafe schemes are not rendered as links.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.renderMarkdown = factory().renderMarkdown;
})(typeof self !== 'undefined' ? self : this, function () {
    var FENCE = /^ {0,3}(```|~~~)\s*([\w-]*)\s*$/;
    var HEADING = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
    var RULE = /^ {0,3}([-*_])(\s*\1){2,}\s*$/;
    var QUOTE = /^ {0,3}> ?/;
    var LIST = /^(\s*)([-*+]|\d+\.)\s+(.*)$/;

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function safeUrl(url) {
        var clean = String(url).replace(/[\u0000- \u007f]/g, '');
        var scheme = clean.match(/^([a-z][a-z0-9+.-]*):/i);
        if (scheme && ['http', 'https', 'mailto'].indexOf(scheme[1].toLowerCase()) === -1) return null;
        return escapeHtml(clean);
    }

    // Stashed tokens pass through untouched and are restored by inline().
    function format(text) {
        return escapeHtml(text)
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/(^|[^\w])__(.+?)__(?!\w)/g, '$1<strong>$2</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/(^|[^\w])_(.+?)_(?!\w)/g, '$1<em>$2</em>')
            .replace(/~~(.+?)~~/g, '<del>$1</del>')
            .replace(/ {2,}\n/g, '<br>\n');
    }

    function inline(source) {
        var stashed = [];
        function stash(html) {
            stashed.push(html);
            return '\u0000' + (stashed.length - 1) + '\u0000';
        }

        var text = String(source).replace(/\u0000/g, '');

        text = text.replace(/(`+)([\s\S]+?)\1/g, function (_, ticks, code) {
            return stash('<code>' + escapeHtml(code) + '</code>');
        });
        text = text.replace(/\\([\\`*_{}[\]()#+\-.!>~])/g, function (_, character) {
            return stash(escapeHtml(character));
        });
        text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, function (match, alt, url, title) {
            var safe = safeUrl(url);
            if (!safe) return match;
            var titleAttr = title ? ' title="' + escapeHtml(title) + '"' : '';
            return stash('<img src="' + safe + '" alt="' + escapeHtml(alt) + '"' + titleAttr + '>');
        });
        text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, function (match, label, url, title) {
            var safe = safeUrl(url);
            if (!safe) return match;
            var titleAttr = title ? ' title="' + escapeHtml(title) + '"' : '';
            return stash('<a href="' + safe + '"' + titleAttr + '>' + format(label) + '</a>');
        });

        var html = format(text);

        var previous;
        do {
            previous = html;
            html = html.replace(/\u0000(\d+)\u0000/g, function (_, index) {
                return stashed[Number(index)];
            });
        } while (html !== previous);
        return html;
    }

    function indentOf(line) {
        return line.match(/^\s*/)[0].length;
    }

    function isBlank(line) {
        return !line || !line.trim();
    }

    function startsBlock(line) {
        return FENCE.test(line) || HEADING.test(line) || RULE.test(line) || QUOTE.test(line) || LIST.test(line);
    }

    function isOrdered(marker) {
        return /\d/.test(marker);
    }

    function parseList(lines, start) {
        var first = lines[start].match(LIST);
        var baseIndent = first[1].length;
        var ordered = isOrdered(first[2]);
        var items = [];
        var i = start;

        function isSibling(line) {
            var match = line !== undefined && line.match(LIST);
            return !!match && match[1].length === baseIndent && isOrdered(match[2]) === ordered && !RULE.test(line);
        }

        while (i < lines.length && isSibling(lines[i])) {
            var match = lines[i].match(LIST);
            var contentIndent = lines[i].length - match[3].length;
            var itemLines = [match[3]];
            var loose = false;
            i++;

            while (i < lines.length) {
                var line = lines[i];
                if (isBlank(line)) {
                    var next = i + 1;
                    while (next < lines.length && isBlank(lines[next])) next++;
                    if (next < lines.length && indentOf(lines[next]) >= contentIndent) {
                        loose = true;
                        itemLines.push('');
                        i++;
                        continue;
                    }
                    break;
                }
                var indent = indentOf(line);
                if (indent >= contentIndent) itemLines.push(line.slice(contentIndent));
                else if (LIST.test(line) && indent > baseIndent) itemLines.push(line.slice(indent));
                else if (startsBlock(line)) break;
                else itemLines.push(line.trim());
                i++;
            }

            var html = blocks(itemLines);
            if (!loose) html = html.replace(/^<p>([\s\S]*?)<\/p>/, function (_, content) { return content; });
            items.push('<li>' + html + '</li>');

            var after = i;
            while (after < lines.length && isBlank(lines[after])) after++;
            if (isSibling(lines[after])) i = after;
        }

        var tag = ordered ? 'ol' : 'ul';
        return { html: '<' + tag + '>\n' + items.join('\n') + '\n</' + tag + '>', next: i };
    }

    function blocks(lines) {
        var output = [];
        var i = 0;

        while (i < lines.length) {
            var line = lines[i];
            var match;

            if (isBlank(line)) {
                i++;
            } else if ((match = line.match(FENCE))) {
                var code = [];
                i++;
                while (i < lines.length && !(lines[i].trim() === match[1])) code.push(lines[i++]);
                i++;
                var language = match[2] ? ' class="language-' + escapeHtml(match[2]) + '"' : '';
                output.push('<pre><code' + language + '>' + escapeHtml(code.join('\n')) + '</code></pre>');
            } else if ((match = line.match(HEADING))) {
                var level = match[1].length;
                output.push('<h' + level + '>' + inline(match[2]) + '</h' + level + '>');
                i++;
            } else if (RULE.test(line)) {
                output.push('<hr>');
                i++;
            } else if (QUOTE.test(line)) {
                var quoted = [];
                while (i < lines.length && QUOTE.test(lines[i])) quoted.push(lines[i++].replace(QUOTE, ''));
                output.push('<blockquote>' + blocks(quoted) + '</blockquote>');
            } else if (LIST.test(line)) {
                var list = parseList(lines, i);
                output.push(list.html);
                i = list.next;
            } else {
                var paragraph = [];
                while (i < lines.length && !isBlank(lines[i]) && !startsBlock(lines[i])) paragraph.push(lines[i++]);
                output.push('<p>' + inline(paragraph.join('\n').trim()) + '</p>');
            }
        }

        return output.join('\n');
    }

    function renderMarkdown(source) {
        return blocks(String(source || '').replace(/\r\n?/g, '\n').split('\n'));
    }

    return { renderMarkdown: renderMarkdown, escapeHtml: escapeHtml };
});
