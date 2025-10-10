(function() {
    const navElement = document.getElementById('researchNav');
    const contentElement = document.getElementById('researchContent');

    function escapeHtml(str) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return str.replace(/[&<>"']/g, char => map[char] || char);
    }

    function toSlug(text, slugCounts) {
        const base = text
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '') || 'section';
        const count = slugCounts[base] || 0;
        slugCounts[base] = count + 1;
        return count === 0 ? base : `${base}-${count}`;
    }

    function linkifyUrls(text) {
        return text.replace(/(https?:\/\/[\w\-._~:?#@!$&'()*+,;=%/]+)(?![^<]*?>)/gi, function(match) {
            return `<a href="${match}" target="_blank" rel="noopener noreferrer">${match}</a>`;
        });
    }

    function inlineMarkdown(text) {
        let result = escapeHtml(text.trim());
        result = result.replace(/`([^`]+)`/g, '<code>$1</code>');
        result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
        result = linkifyUrls(result);
        result = result.replace(/&lt;br\/?&gt;/gi, '<br>');
        return result;
    }

    function parseTable(rows) {
        if (!rows.length) {
            return '';
        }

        const extractCells = (row) => row.slice(1, -1).split('|').map(cell => inlineMarkdown(cell.trim()));
        const headerCells = extractCells(rows[0]);
        const hasDivider = rows[1] && /^\|[-: ]+\|$/.test(rows[1].trim());
        const bodyRows = rows.slice(hasDivider ? 2 : 1).map(extractCells);

        let tableHtml = '<table><thead><tr>';
        headerCells.forEach(cell => {
            tableHtml += `<th scope="col">${cell}</th>`;
        });
        tableHtml += '</tr></thead>';

        if (bodyRows.length) {
            tableHtml += '<tbody>';
            bodyRows.forEach(row => {
                tableHtml += '<tr>';
                row.forEach(cell => {
                    tableHtml += `<td>${cell}</td>`;
                });
                tableHtml += '</tr>';
            });
            tableHtml += '</tbody>';
        }

        tableHtml += '</table>';
        return tableHtml;
    }

    function parseMarkdown(markdown) {
        const lines = markdown.replace(/\r\n/g, '\n').split('\n');
        const html = [];
        const headings = [];
        const slugCounts = {};
        const listStack = [];
        let openListItem = false;
        let inParagraph = false;
        let inBlockquote = false;
        let blockquoteParagraphOpen = false;
        let inTable = false;
        let tableRows = [];

        function closeParagraph() {
            if (inParagraph) {
                html.push('</p>');
                inParagraph = false;
            }
        }

        function closeBlockquote() {
            if (blockquoteParagraphOpen) {
                html.push('</p>');
                blockquoteParagraphOpen = false;
            }
            if (inBlockquote) {
                html.push('</blockquote>');
                inBlockquote = false;
            }
        }

        function closeListItem() {
            if (openListItem) {
                html.push('</li>');
                openListItem = false;
            }
        }

        function adjustListDepth(targetDepth) {
            while (listStack.length > targetDepth) {
                closeListItem();
                html.push('</ul>');
                listStack.pop();
            }
            while (listStack.length < targetDepth) {
                html.push('<ul>');
                listStack.push(true);
            }
        }

        function closeAllLists() {
            closeListItem();
            adjustListDepth(0);
        }

        function flushTable() {
            if (inTable && tableRows.length) {
                html.push(parseTable(tableRows));
            }
            inTable = false;
            tableRows = [];
        }

        lines.forEach((rawLine, index) => {
            const line = rawLine.replace(/\s+$/g, '');
            const trimmed = line.trim();

            if (!trimmed) {
                flushTable();
                closeParagraph();
                if (inBlockquote) {
                    if (blockquoteParagraphOpen) {
                        html.push('</p>');
                        blockquoteParagraphOpen = false;
                    }
                } else {
                    closeAllLists();
                }
                return;
            }

            const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
            if (headingMatch) {
                flushTable();
                closeParagraph();
                closeAllLists();
                closeBlockquote();

                const level = headingMatch[1].length;
                const text = headingMatch[2].trim();
                const slug = toSlug(text, slugCounts);
                const headingHtml = inlineMarkdown(text);
                html.push(`<h${level} id="${slug}">${headingHtml}</h${level}>`);
                if (level >= 2 && level <= 4) {
                    headings.push({ level, text, slug });
                }
                return;
            }

            const tableMatch = /^\|.*\|$/.test(trimmed);
            if (tableMatch) {
                closeParagraph();
                closeBlockquote();
                if (!inTable) {
                    closeAllLists();
                    inTable = true;
                    tableRows = [];
                }
                tableRows.push(trimmed);
                return;
            }

            flushTable();

            const blockquoteMatch = trimmed.match(/^>\s?(.*)$/);
            if (blockquoteMatch) {
                closeParagraph();
                closeAllLists();

                if (!inBlockquote) {
                    html.push('<blockquote>');
                    inBlockquote = true;
                    blockquoteParagraphOpen = false;
                }

                const content = blockquoteMatch[1];

                if (!content) {
                    if (blockquoteParagraphOpen) {
                        html.push('</p>');
                        blockquoteParagraphOpen = false;
                    }
                } else {
                    if (!blockquoteParagraphOpen) {
                        html.push('<p>');
                        blockquoteParagraphOpen = true;
                    } else {
                        html.push('<br>');
                    }
                    html.push(inlineMarkdown(content));
                }
                return;
            }

            closeBlockquote();

            const listMatch = trimmed.match(/^(\s*)([-*+])\s+(.*)$/);
            if (listMatch) {
                flushTable();
                closeParagraph();

                const indent = Math.floor(listMatch[1].replace(/\t/g, '    ').length / 2);
                const depth = indent + 1;

                adjustListDepth(depth);
                closeListItem();
                html.push(`<li>${inlineMarkdown(listMatch[3])}`);
                openListItem = true;
                return;
            }

            closeAllLists();

            if (!inParagraph) {
                html.push('<p>');
                inParagraph = true;
            } else {
                html.push(' ');
            }
            html.push(inlineMarkdown(trimmed));
        });

        flushTable();
        closeParagraph();
        closeBlockquote();
        closeAllLists();

        return { html: html.join(''), headings };
    }

    function buildNav(headings) {
        if (!navElement) {
            return;
        }

        const navItems = headings.map(heading => {
            const safeText = escapeHtml(heading.text);
            return `<li><a class="nav-level-${heading.level}" href="#${heading.slug}">${safeText}</a></li>`;
        }).join('');

        navElement.innerHTML = navItems || '<li><span>No sections found</span></li>';
    }

    async function loadResearch() {
        if (!contentElement) {
            return;
        }

        try {
            const cacheBust = new Date().getTime();
            const response = await fetch(`research.md?v=${cacheBust}`, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to load research.md (status ${response.status})`);
            }

            const markdown = await response.text();
            const { html, headings } = parseMarkdown(markdown);

            contentElement.innerHTML = html;
            buildNav(headings);
        } catch (error) {
            console.error('Error loading research markdown:', error);
            contentElement.innerHTML = `
                <div class="validation-warnings">
                    <h3>⚠️ Unable to load references</h3>
                    <p>${escapeHtml(error.message)}</p>
                    <p><em>Please verify that research.md is accessible.</em></p>
                </div>
            `;
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (window.themeManager?.setupTheme) {
            window.themeManager.setupTheme();
        }
        loadResearch();
    });
})();
