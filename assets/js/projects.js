// projects.js
// Manages loading projects, populating the project table/folder/submenu,
// parsing case-study Markdown (YAML frontmatter, Heading blocks, @media shortcodes,
// inline media, callout cards, CTA links), and rendering Win98/2K/Y2K project detail windows.

import {
    openWindow,
    closeWindow,
    minimizeWindow,
    bringToFront,
    setupDragging,
    setupResizing
} from './windows.js';

let projectsData = [];

// Escape HTML entities for safe injection
export function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Resolve a project-relative asset path to a SidePortfolio URL
export function resolveAssetUrl(path, projectFolder = '', fallback = 'assets/icons/w2k_unknown_14.png') {
    if (!path) return fallback;
    let trimmed = String(path).trim();
    if (!trimmed) return fallback;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    try {
        trimmed = decodeURIComponent(trimmed);
    } catch (e) {
        // Keep raw if malformed percent-encoding
    }
    trimmed = trimmed.replace(/^\/+/, '');
    if (trimmed.startsWith('projects/')) {
        return encodeURI(trimmed);
    }
    if (projectFolder && !trimmed.startsWith(projectFolder + '/')) {
        return encodeURI('projects/' + projectFolder + '/' + trimmed);
    }
    return encodeURI('projects/' + trimmed);
}

// Resolve links that point to MainPortfolio routes (/blog/..., /apps/..., /projects/...)
export function resolveActionUrl(rawUrl) {
    if (!rawUrl) return '#';
    const trimmed = String(rawUrl).trim();
    if (trimmed.startsWith('/blog/') || trimmed.startsWith('/apps/') || trimmed.startsWith('/cv/') || trimmed.startsWith('/aboutme/')) {
        return 'https://uluckaymak.com' + trimmed;
    }
    if (trimmed.startsWith('/projects/')) {
        return 'https://uluckaymak.com' + trimmed;
    }
    return trimmed;
}

export function formatYearShort(dateStr) {
    if (!dateStr) return '';
    return String(dateStr).split(/[-_]/)[0];
}

export function formatDate(dateStr) {
    if (!dateStr) return '';
    const parts = String(dateStr).split(/[-_]/);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (parts.length >= 3) {
        const year = parts[0];
        const monthIndex = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        if (monthIndex >= 0 && monthIndex < 12 && !isNaN(day)) {
            return `${months[monthIndex]} ${day}, ${year}`;
        }
    } else if (parts.length === 2) {
        const year = parts[0];
        const monthIndex = parseInt(parts[1], 10) - 1;
        if (monthIndex >= 0 && monthIndex < 12) {
            return `${months[monthIndex]} ${year}`;
        }
    }
    return String(dateStr).replace(/[-_]/g, ' ');
}

function slugify(str) {
    return String(str)
        .toLowerCase()
        .replace(/<[^>]*>/g, '')
        .replace(/[^a-z0-9\u00c0-\u024f\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

function formatMediaCaption(cleanPath, fallbackTitle = '') {
    let decoded = cleanPath;
    try {
        decoded = decodeURIComponent(cleanPath);
    } catch (e) {}
    const filename = decoded.split('/').pop().replace(/\.[^.]+$/, '');
    if (!filename || /^(ss_|img_|dsc_|dsc\d|mvi_|whatsapp|image\d|screenshot\d|header$|cover$|untitled|[a-zA-Z0-9_-]{6}$)/i.test(filename)) {
        return fallbackTitle;
    }
    return filename.replace(/[-_]+/g, ' ').trim();
}

// Extract a concise one-line summary from raw description.md (frontmatter subtitle or first prose sentence)
export function extractMiniDescription(rawText) {
    if (!rawText) return '';
    const normalized = rawText.replace(/\r\n/g, '\n');
    let body = normalized;

    const fmMatch = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)\n*/);
    if (fmMatch) {
        const fm = fmMatch[1];
        body = normalized.slice(fmMatch[0].length);
        const subMatch = fm.match(/^subtitle\s*:\s*(.+)$/m);
        if (subMatch && subMatch[1].trim()) {
            return subMatch[1].trim().replace(/^["']|["']$/g, '');
        }
    }

    const lines = body.split('\n');
    for (const line of lines) {
        const t = line.trim();
        if (!t) continue;
        if (t.startsWith('#') || t.startsWith('![') || t.startsWith('@media') || t.startsWith('>') || t.startsWith('<') || t.startsWith('---')) continue;
        if (/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.test(t)) continue;
        if (/^(Listen on|Stream on):?$/i.test(t)) continue;
        const clean = t
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/(\*\*|\*|__|_|`)/g, '')
            .trim();
        if (clean.length > 15) {
            return clean;
        }
    }
    return '';
}

// Parse optional YAML frontmatter + extract standalone CTA links
export function parseProjectMarkdown(rawText) {
    const meta = {
        subtitle: '',
        studio: '',
        studioLabel: 'Studio',
        format: '',
        formatLabel: 'Format',
        status: '',
        tools: '',
        stats: [],
        highlights: [],
        pipeline: [],
        links: []
    };

    if (!rawText) return { meta, body: '' };

    let text = rawText.replace(/\r\n/g, '\n');

    // 1. Parse optional YAML frontmatter: --- ... ---
    const fmMatch = text.match(/^---\n([\s\S]*?)\n---(?:\n|$)\n*/);
    if (fmMatch) {
        const fmContent = fmMatch[1];
        text = text.slice(fmMatch[0].length);

        let currentListKey = null;
        fmContent.split('\n').forEach(line => {
            const listMatch = line.match(/^\s*-\s+(.+)$/);
            if (listMatch && currentListKey && Array.isArray(meta[currentListKey])) {
                const cleanItem = listMatch[1].trim().replace(/^["']|["']$/g, '');
                meta[currentListKey].push(cleanItem);
                return;
            }

            const kvMatch = line.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
            if (kvMatch) {
                const key = kvMatch[1].trim().toLowerCase();
                const val = kvMatch[2].trim();
                const cleanVal = val.replace(/^["']|["']$/g, '');
                if (['stats', 'highlights', 'pipeline', 'links'].includes(key)) {
                    currentListKey = key;
                    if (val) meta[key].push(cleanVal);
                } else if (key === 'client') {
                    currentListKey = null;
                    meta.studio = cleanVal;
                    meta.studioLabel = 'Client';
                } else if (key === 'exhibition') {
                    currentListKey = null;
                    meta.studio = cleanVal;
                    meta.studioLabel = 'Exhibition';
                } else if (key === 'studio') {
                    currentListKey = null;
                    meta.studio = cleanVal;
                    meta.studioLabel = 'Studio';
                } else if (key === 'studio_label') {
                    currentListKey = null;
                    const sl = cleanVal.toLowerCase();
                    meta.studioLabel = sl === 'client' ? 'Client' : (sl === 'exhibition' ? 'Exhibition' : 'Studio');
                } else if (key === 'genre') {
                    currentListKey = null;
                    meta.format = cleanVal;
                    meta.formatLabel = 'Genre';
                } else if (key === 'format') {
                    currentListKey = null;
                    meta.format = cleanVal;
                    meta.formatLabel = 'Format';
                } else if (key === 'format_label') {
                    currentListKey = null;
                    meta.formatLabel = cleanVal.toLowerCase() === 'genre' ? 'Genre' : 'Format';
                } else {
                    currentListKey = null;
                    meta[key] = cleanVal;
                }
            }
        });
    }

    // 2. Extract standalone markdown links from frontmatter and standalone link lines
    const extractedLinks = [];
    meta.links.forEach(item => {
        const parts = String(item).split('|').map(s => s.trim());
        if (parts.length >= 2) {
            extractedLinks.push({ label: parts[0], url: resolveActionUrl(parts.slice(1).join('|')) });
        }
    });

    const lines = text.split('\n');
    const keptLines = [];
    const standaloneLinkRegex = /^\s*(?:[-*]\s+)?(?:You can listen (?:to the EP )?on:?|Listen on:?|Stream on:?|Play it on:?|Watch on:?)?\s*\[([^\]]+)\]\(([^)]+)\)\s*$/i;

    lines.forEach(line => {
        const trimmed = line.trim();
        if (/^(Listen on|Stream on):?\s*$/i.test(trimmed)) {
            return;
        }
        // Keep image/video links ![...](...) in the body
        if (trimmed.startsWith('![')) {
            keptLines.push(line);
            return;
        }
        const m = line.match(standaloneLinkRegex);
        if (m) {
            const label = m[1].trim();
            const url = resolveActionUrl(m[2].trim());
            if (!extractedLinks.some(l => l.url === url)) {
                extractedLinks.push({ label, url });
            }
        } else {
            keptLines.push(line);
        }
    });

    meta.links = extractedLinks;
    const body = keptLines.join('\n').trim();

    return { meta, body };
}

// Match a path or numeric index against project.media and mark it as used
function resolveAndTrackMedia(token, mediaList, projectFolder, usedIndices) {
    let trimmed = String(token || '').trim();
    try {
        trimmed = decodeURIComponent(trimmed);
    } catch (e) {}

    if (/^\d+$/.test(trimmed)) {
        const idx = parseInt(trimmed, 10);
        if (idx >= 0 && idx < mediaList.length) {
            usedIndices.add(idx);
            return mediaList[idx];
        }
    }

    const lowerToken = trimmed.normalize('NFC').toLowerCase();
    for (let i = 0; i < mediaList.length; i++) {
        const item = mediaList[i];
        let decodedItem = item;
        try {
            decodedItem = decodeURIComponent(item);
        } catch (e) {}
        const lowerItem = decodedItem.normalize('NFC').toLowerCase();
        if (lowerItem === lowerToken || lowerItem.endsWith('/' + lowerToken)) {
            usedIndices.add(i);
            return item;
        }
    }

    return trimmed;
}

// Extract YouTube video ID and optional start timestamp
function parseYouTubeUrl(raw) {
    const ytMatch = String(raw).match(/^.*(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]{11}).*/);
    if (!ytMatch) return null;
    const videoId = ytMatch[1];
    let startSec = 0;
    const tMatch = String(raw).match(/[?&]t=(\d+)s?/i);
    if (tMatch) {
        startSec = parseInt(tMatch[1], 10) || 0;
    }
    return { videoId, startSec };
}

// Render any single media path (image, YouTube, Spotify, Bandcamp, MP4, WAV/MP3) into HTML
function renderMediaItemHtml(mediaPath, project, projectFolder, customCaption = '', layoutHint = '', customAlt = '') {
    if (!mediaPath || String(mediaPath).trim().startsWith('//')) return '';
    const raw = String(mediaPath).trim();
    const cleanCaptionInput = customCaption.replace(/^["']|["']$/g, '').trim();
    const hideCaption = cleanCaptionInput === '-' || cleanCaptionInput.toLowerCase() === 'none';

    // 1. YouTube Detection
    const ytInfo = parseYouTubeUrl(raw);
    if (ytInfo) {
        const embedUrl = `https://www.youtube.com/embed/${ytInfo.videoId}${ytInfo.startSec ? `?start=${ytInfo.startSec}` : ''}`;
        const cap = hideCaption ? '' : (cleanCaptionInput !== 'YouTube' ? cleanCaptionInput : '');
        return `
            <figure class="sp-media-embed sp-media-youtube">
                <div class="sp-video-responsive">
                    <iframe
                        src="${escapeHtml(embedUrl)}"
                        title="${escapeHtml(cap || project.title)}"
                        frameborder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen
                        loading="lazy">
                    </iframe>
                </div>
                ${cap ? `<figcaption class="sp-figcaption">${escapeHtml(cap)}</figcaption>` : ''}
            </figure>
        `;
    }

    // 2. Spotify Detection
    if (raw.includes('open.spotify.com')) {
        const spotifyId = raw.split('/').pop().split('?')[0];
        let type = 'track';
        if (raw.includes('/album/')) type = 'album';
        else if (raw.includes('/artist/')) type = 'artist';
        else if (raw.includes('/playlist/')) type = 'playlist';
        const cap = hideCaption ? '' : cleanCaptionInput;

        return `
            <div class="sp-media-embed sp-media-spotify">
                <iframe src="https://open.spotify.com/embed/${type}/${escapeHtml(spotifyId)}"
                    width="100%" height="152" frameborder="0" allowtransparency="true"
                    allow="encrypted-media" loading="lazy"></iframe>
                ${cap ? `<div class="sp-figcaption">${escapeHtml(cap)}</div>` : ''}
            </div>
        `;
    }

    // 3. Bandcamp Detection
    if (raw.includes('bandcamp.com') && raw.includes('/EmbeddedPlayer/')) {
        return `
            <div class="sp-media-embed sp-media-bandcamp">
                <iframe style="border: 0; width: 100%; height: 120px;" src="${escapeHtml(raw)}" seamless loading="lazy"></iframe>
            </div>
        `;
    }

    const cleanPath = raw.split('?')[0];
    const ext = cleanPath.split('.').pop().toLowerCase();
    const resolvedUrl = resolveAssetUrl(raw, projectFolder, '');

    // 4. Image
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
        const captionText = hideCaption ? '' : (cleanCaptionInput || formatMediaCaption(cleanPath, ''));
        const altText = customAlt || captionText || project.title;
        const layoutClass = layoutHint === 'left' ? 'sp-figure-left'
            : layoutHint === 'right' ? 'sp-figure-right'
            : layoutHint === 'wide' ? 'sp-figure-wide'
            : '';

        return `
            <figure class="sp-figure ${layoutClass} sp-expandable-media" data-media-src="${escapeHtml(resolvedUrl)}" data-media-title="${escapeHtml(captionText || altText)}">
                <div class="sp-figure-frame">
                    <img src="${escapeHtml(resolvedUrl)}" alt="${escapeHtml(altText)}" loading="lazy">
                </div>
                ${captionText ? `<figcaption class="sp-figcaption">${escapeHtml(captionText)}</figcaption>` : ''}
            </figure>
        `;
    }

    // 5. Video
    if (['mp4', 'webm', 'mov'].includes(ext)) {
        const cap = hideCaption ? '' : (cleanCaptionInput || formatMediaCaption(cleanPath, ''));
        return `
            <figure class="sp-media-embed sp-media-video">
                <video controls playsinline preload="metadata" aria-label="${escapeHtml(customAlt || cap || project.title)}">
                    <source src="${escapeHtml(resolvedUrl)}#t=0.001" type="video/${ext === 'mov' ? 'mp4' : ext}">
                </video>
                ${cap ? `<figcaption class="sp-figcaption">${escapeHtml(cap)}</figcaption>` : ''}
            </figure>
        `;
    }

    // 6. Audio
    if (['mp3', 'wav', 'ogg'].includes(ext)) {
        const audioTitle = cleanCaptionInput || formatMediaCaption(cleanPath, project.title);
        return `
            <div class="sp-media-embed sp-media-audio">
                <div class="sp-audio-box sunken-panel">
                    <div class="sp-audio-header">
                        <img src="assets/icons/w2k_audio_cd.png" class="pixel-icon" alt="" style="width: 16px; height: 16px;">
                        <span class="sp-audio-title">${escapeHtml(audioTitle)}</span>
                    </div>
                    <audio src="${escapeHtml(resolvedUrl)}" controls preload="metadata" style="width: 100%; height: 28px;"></audio>
                </div>
                ${customAlt ? `<div class="sp-figcaption">${escapeHtml(customAlt)}</div>` : ''}
            </div>
        `;
    }

    return '';
}

// Expand @media(...) shortcodes and normalize spaces/parentheses in ![alt](file (1).jpg) before marked.parse
function expandMediaShortcodes(markdownText, project, projectFolder, usedIndices) {
    const mediaList = Array.isArray(project.media) ? project.media : [];

    // Allow filenames with spaces or parentheses inside standard Markdown image syntax ![alt](file (1).jpg)
    const normalizedMd = markdownText.replace(/!\[([^\]]*)\]\(((?:[^()\n]|\([^()\n]*\))+)\)/g, (_, alt, rawUrl) => {
        const cleanUrl = rawUrl.trim().replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29');
        return `![${alt}](${cleanUrl})`;
    });

    return normalizedMd.replace(/^[ \t]*@media\(([^)]+)\)[ \t]*$/gm, (_, inner) => {
        const pipeParts = inner.split('|').map(s => s.trim());
        const selectorPart = pipeParts[0];
        const captionPart = pipeParts[1] || '';

        const rangeMatch = selectorPart.match(/^(\d+)\s*-\s*(\d+)$/);
        let itemsToRender = [];

        if (rangeMatch) {
            const start = parseInt(rangeMatch[1], 10);
            const end = parseInt(rangeMatch[2], 10);
            for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
                if (i >= 0 && i < mediaList.length) {
                    usedIndices.add(i);
                    itemsToRender.push(mediaList[i]);
                }
            }
        } else if (selectorPart.includes(',')) {
            itemsToRender = selectorPart
                .split(',')
                .map(tok => resolveAndTrackMedia(tok, mediaList, projectFolder, usedIndices))
                .filter(Boolean);
        } else {
            const single = resolveAndTrackMedia(selectorPart, mediaList, projectFolder, usedIndices);
            if (single) itemsToRender.push(single);
        }

        if (itemsToRender.length === 0) return '';
        const compactHtml = (str) => str.replace(/\n\s*/g, ' ').trim();
        if (itemsToRender.length === 1) {
            const altPart = pipeParts[2] || '';
            return `\n\n<div class="sp-inline-media">${compactHtml(renderMediaItemHtml(itemsToRender[0], project, projectFolder, captionPart, '', altPart))}</div>\n\n`;
        }

        return `\n\n<div class="sp-media-row">${itemsToRender.map((m, idx) => {
            const perItemCaption = pipeParts.length > 2 ? (pipeParts[idx + 1] || '') : captionPart;
            return compactHtml(renderMediaItemHtml(m, project, projectFolder, perItemCaption));
        }).join('')}</div>\n\n`;
    });
}

// Split markdown body into separate Heading Blocks (each # or --- starts its own block; ## stays inside)
function splitIntoHeadingBlocks(markdownBody) {
    if (!markdownBody || !markdownBody.trim()) return [];

    const lines = markdownBody.split('\n');
    const blocks = [];
    let currentBlock = null;
    let inCodeFence = false;

    lines.forEach(line => {
        if (/^```/.test(line.trim())) {
            inCodeFence = !inCodeFence;
        }

        const headingMatch = !inCodeFence && line.match(/^#\s+(.+)$/);
        const hrMatch = !inCodeFence && /^---+\s*$/.test(line.trim());
        if (headingMatch) {
            if (currentBlock && (currentBlock.title || currentBlock.lines.join('').trim())) {
                blocks.push(currentBlock);
            }
            const titleText = headingMatch[1].trim();
            currentBlock = {
                title: titleText,
                id: 'sec-' + (slugify(titleText) || (blocks.length + 1)),
                lines: []
            };
        } else if (hrMatch) {
            if (currentBlock && (currentBlock.title || currentBlock.lines.join('').trim())) {
                blocks.push(currentBlock);
            }
            currentBlock = {
                title: '',
                id: 'sec-block-' + (blocks.length + 1),
                lines: []
            };
        } else {
            if (!currentBlock) {
                currentBlock = {
                    title: '',
                    id: 'sec-overview',
                    lines: []
                };
            }
            currentBlock.lines.push(line);
        }
    });

    if (currentBlock && (currentBlock.title || currentBlock.lines.join('').trim())) {
        blocks.push(currentBlock);
    }

    return blocks.map(b => ({
        title: b.title,
        id: b.id,
        markdown: b.lines.join('\n').trim()
    }));
}

// Enhance rendered Heading Block HTML (callout blockquotes, inline figures, side-by-side image pairs)
function enhanceBlockHtml(html, project, projectFolder, usedIndices) {
    const mediaList = Array.isArray(project.media) ? project.media : [];
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // 1. Convert > [!PROBLEM], > [!SOLUTION], > [!NOTE], > [!HIGHLIGHT] blockquotes into cards
    const blockquotes = Array.from(temp.querySelectorAll('blockquote'));
    blockquotes.forEach(bq => {
        const inner = bq.innerHTML.trim();
        const calloutMatch = inner.match(/^<p>\s*\[!(PROBLEM|SOLUTION|NOTE|HIGHLIGHT)\]\s*([^\n<]*)(?:<br\s*\/?>|\n)?([\s\S]*?)<\/p>([\s\S]*)$/i);
        if (calloutMatch) {
            const type = calloutMatch[1].toUpperCase();
            const title = calloutMatch[2].trim();
            const firstParaRest = calloutMatch[3].trim();
            const remainingHtml = calloutMatch[4].trim();

            const card = document.createElement('div');
            const isSolution = type === 'SOLUTION' || type === 'HIGHLIGHT';
            card.className = `sp-callout-card ${isSolution ? 'sp-callout-solution' : 'sp-callout-problem'}`;

            const badgeLabel = type === 'PROBLEM' ? 'The Challenge'
                : type === 'SOLUTION' ? 'The Solution'
                : type === 'HIGHLIGHT' ? 'Key Insight' : 'Note';

            card.innerHTML = `
                <div class="sp-callout-eyebrow">${escapeHtml(badgeLabel)}</div>
                ${title ? `<h4 class="sp-callout-title">${escapeHtml(title)}</h4>` : ''}
                <div class="sp-callout-body">
                    ${firstParaRest ? `<p>${firstParaRest}</p>` : ''}
                    ${remainingHtml}
                </div>
            `;
            bq.replaceWith(card);
        }
    });

    // Pair adjacent Problem + Solution cards into a 2-column grid
    const problemCards = Array.from(temp.querySelectorAll('.sp-callout-problem'));
    problemCards.forEach(prob => {
        const nextEl = prob.nextElementSibling;
        if (nextEl && nextEl.classList.contains('sp-callout-solution')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'sp-problem-solution-grid';
            prob.parentNode.insertBefore(wrapper, prob);
            wrapper.appendChild(prob);
            wrapper.appendChild(nextEl);
        }
    });

    // 2. Upgrade markdown <img> tags (including inline YouTube/video/images)
    const rawImgs = Array.from(temp.querySelectorAll('img')).filter(img => !img.closest('.sp-figure, .sp-audio-box'));
    rawImgs.forEach(img => {
        const rawSrc = img.getAttribute('src') || '';
        const matchedMedia = resolveAndTrackMedia(rawSrc, mediaList, projectFolder, usedIndices);

        let altRaw = (img.getAttribute('alt') || '').trim();
        let layoutHint = '';
        const layoutMatch = altRaw.match(/^(left|sol|right|sağ|sag|wide|geniş|genis)\s*\|\s*(.*)$/i);
        if (layoutMatch) {
            const dir = layoutMatch[1].toLowerCase();
            if (dir === 'left' || dir === 'sol') layoutHint = 'left';
            else if (dir === 'right' || dir === 'sağ' || dir === 'sag') layoutHint = 'right';
            else layoutHint = 'wide';
            altRaw = layoutMatch[2].trim();
        }

        const renderedHtml = renderMediaItemHtml(matchedMedia, project, projectFolder, altRaw, layoutHint);
        const wrapper = document.createElement('div');
        wrapper.innerHTML = renderedHtml.trim();
        const figureNode = wrapper.firstElementChild;
        if (!figureNode) return;

        const parent = img.parentElement;
        if (parent && parent.tagName === 'P') {
            const onlyImagesAndBr = Array.from(parent.childNodes).every(node => {
                if (node.nodeType === Node.TEXT_NODE) return !node.textContent.trim();
                return node.tagName === 'IMG' || node.tagName === 'BR' || (node.classList && (node.classList.contains('sp-figure') || node.classList.contains('sp-media-embed')));
            });
            if (onlyImagesAndBr && parent.querySelectorAll('img, .sp-figure, .sp-media-embed').length === 1) {
                parent.replaceWith(figureNode);
            } else {
                img.replaceWith(figureNode);
            }
        } else {
            img.replaceWith(figureNode);
        }
    });

    // Group paragraphs containing multiple consecutive figures into a side-by-side .sp-media-row
    Array.from(temp.querySelectorAll('p')).forEach(p => {
        const figs = Array.from(p.querySelectorAll(':scope > .sp-figure'));
        const hasText = Array.from(p.childNodes).some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim().length > 0);
        if (figs.length > 1 && !hasText) {
            const row = document.createElement('div');
            row.className = 'sp-media-row';
            figs.forEach(f => row.appendChild(f));
            p.replaceWith(row);
        }
    });

    // Also pair adjacent standalone .sp-figure siblings (when not floated/wide)
    const topFigures = Array.from(temp.querySelectorAll(':scope > .sp-figure:not(.sp-figure-left):not(.sp-figure-right):not(.sp-figure-wide)'));
    for (let i = 0; i < topFigures.length; i++) {
        const current = topFigures[i];
        if (!current.parentElement) continue;
        const next = current.nextElementSibling;
        if (next && next.classList.contains('sp-figure') &&
            !next.classList.contains('sp-figure-left') &&
            !next.classList.contains('sp-figure-right') &&
            !next.classList.contains('sp-figure-wide')) {
            const row = document.createElement('div');
            row.className = 'sp-media-row';
            current.parentNode.insertBefore(row, current);
            row.appendChild(current);
            row.appendChild(next);
            i++;
        }
    }

    // Ensure all links inside prose resolve cleanly and open external URLs in a new tab
    temp.querySelectorAll('a').forEach(a => {
        const rawHref = a.getAttribute('href') || '';
        const resolved = resolveActionUrl(rawHref);
        a.setAttribute('href', resolved);
        if (!resolved.startsWith('#')) {
            a.setAttribute('target', '_blank');
            a.setAttribute('rel', 'noopener');
        }
    });

    return temp.innerHTML;
}

// Render an item inside the right-hand Preview Explorer gallery panel
function renderGalleryItemHtml(rawMediaPath, project, projectFolder) {
    if (!rawMediaPath || String(rawMediaPath).trim().startsWith('//')) return '';
    const raw = String(rawMediaPath).trim();

    // 1. YouTube
    const ytInfo = parseYouTubeUrl(raw);
    if (ytInfo) {
        const embedUrl = `https://www.youtube.com/embed/${ytInfo.videoId}${ytInfo.startSec ? `?start=${ytInfo.startSec}` : ''}`;
        return `
            <div class="sp-gallery-card sp-gallery-embed">
                <div class="sp-video-responsive">
                    <iframe
                        src="${escapeHtml(embedUrl)}"
                        title="${escapeHtml(project.title)}"
                        frameborder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen
                        loading="lazy">
                    </iframe>
                </div>
                <div class="sp-gallery-caption">YouTube Video</div>
            </div>
        `;
    }

    // 2. Spotify
    if (raw.includes('open.spotify.com')) {
        const spotifyId = raw.split('/').pop().split('?')[0];
        let type = 'track';
        if (raw.includes('/album/')) type = 'album';
        else if (raw.includes('/artist/')) type = 'artist';
        else if (raw.includes('/playlist/')) type = 'playlist';
        return `
            <div class="sp-gallery-card sp-gallery-embed">
                <iframe src="https://open.spotify.com/embed/${type}/${escapeHtml(spotifyId)}"
                    width="100%" height="152" frameborder="0" allowtransparency="true"
                    allow="encrypted-media" loading="lazy"></iframe>
            </div>
        `;
    }

    // 3. Bandcamp Embed
    if (raw.includes('bandcamp.com') && raw.includes('/EmbeddedPlayer/')) {
        return `
            <div class="sp-gallery-card sp-gallery-embed">
                <iframe style="border: 0; width: 100%; height: 120px;" src="${escapeHtml(raw)}" seamless loading="lazy"></iframe>
            </div>
        `;
    }

    const cleanPath = raw.split('?')[0];
    const ext = cleanPath.split('.').pop().toLowerCase();
    const src = resolveAssetUrl(raw, projectFolder, '');
    const caption = formatMediaCaption(cleanPath, project.title);

    // 4. Video file
    if (['mp4', 'mov', 'webm'].includes(ext)) {
        return `
            <div class="sp-gallery-card project-media-item" data-src="${escapeHtml(src)}" data-title="${escapeHtml(caption)}">
                <div class="sp-gallery-video-thumb">
                    <video src="${escapeHtml(src)}#t=0.5" preload="metadata" muted playsinline></video>
                    <div class="sp-gallery-play-overlay">
                        <img src="assets/icons/w2k_mplayer32_1.png" class="pixel-icon" alt="Play" style="width: 24px; height: 24px;" />
                    </div>
                </div>
                <div class="sp-gallery-caption">${escapeHtml(caption)}</div>
            </div>
        `;
    }

    // 5. Audio file
    if (['mp3', 'wav', 'ogg'].includes(ext)) {
        return `
            <div class="sp-gallery-card sp-gallery-audio" data-src="${escapeHtml(src)}" data-title="${escapeHtml(caption)}">
                <div class="sp-audio-box sunken-panel">
                    <div class="sp-audio-header">
                        <img src="assets/icons/w2k_audio_cd.png" class="pixel-icon" alt="" style="width: 16px; height: 16px;">
                        <span class="sp-audio-title">${escapeHtml(caption)}</span>
                    </div>
                    <audio src="${escapeHtml(src)}" controls preload="metadata" style="width: 100%; height: 28px;"></audio>
                </div>
            </div>
        `;
    }

    // 6. Image file
    return `
        <div class="sp-gallery-card project-media-item sp-expandable-media" data-src="${escapeHtml(src)}" data-media-src="${escapeHtml(src)}" data-title="${escapeHtml(caption)}" data-media-title="${escapeHtml(caption)}">
            <img src="${escapeHtml(src)}" alt="${escapeHtml(caption)}" loading="lazy" />
            <div class="sp-gallery-caption">${escapeHtml(caption)}</div>
        </div>
    `;
}

// --- Load Projects ---
export const loadProjects = async () => {
    try {
        const response = await fetch('projects.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const allProjects = await response.json();
        projectsData = allProjects.filter(p => p.enabled);

        populateProjectsTable();
        populateProjectsFolder();
        populateProjectsSubmenu();
    } catch (error) {
        console.error('Error loading projects:', error);
        const tbody = document.getElementById('portfolio-projects-body');
        if (tbody) tbody.innerHTML = '<tr><td colspan="3">Error loading projects.</td></tr>';
        const grid = document.getElementById('project-grid');
        if (grid) grid.innerHTML = '<p>Error loading projects.</p>';
    }
};

// Populate the start menu submenu with projects
const populateProjectsSubmenu = () => {
    const submenu = document.getElementById('projects-submenu');
    if (!submenu) return;

    submenu.innerHTML = '';

    projectsData.forEach(project => {
        const li = document.createElement('li');
        li.textContent = project.title;
        li.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showProjectDetail(project);
            const startMenu = document.getElementById('start-menu');
            if (startMenu) startMenu.style.display = 'none';
        });
        submenu.appendChild(li);
    });
};

// Populate project_list.exe table
const populateProjectsTable = () => {
    const tbody = document.getElementById('portfolio-projects-body');
    const openBtn = document.getElementById('open-project-btn');
    if (!tbody || !openBtn) return;

    let selectedProject = null;
    const eventType = window.innerWidth <= 768 ? 'click' : 'dblclick';

    tbody.innerHTML = '';
    const countEl = document.getElementById('project-count-table');
    if (countEl) countEl.textContent = projectsData.length;

    projectsData.forEach(proj => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${escapeHtml(proj.title)}</td><td>${escapeHtml(proj.type)}</td><td>${escapeHtml(formatDate(proj.date))}</td>`;
        tr.style.cursor = 'pointer';

        tr.addEventListener('click', () => {
            const prev = tbody.querySelector('tr.highlighted');
            if (prev) prev.classList.remove('highlighted');

            tr.classList.add('highlighted');
            selectedProject = proj;

            openBtn.disabled = false;
            openBtn.onclick = () => showProjectDetail(selectedProject);
        });

        tr.addEventListener(eventType, () => showProjectDetail(proj));
        tbody.appendChild(tr);
    });

    openBtn.disabled = true;
};

// Populate All Projects folder grid
const populateProjectsFolder = () => {
    const grid = document.getElementById('project-grid');
    if (!grid) return;

    grid.innerHTML = '';
    const countEl = document.getElementById('project-count-folder');
    if (countEl) countEl.textContent = projectsData.length;

    const eventType = window.innerWidth <= 768 ? 'click' : 'dblclick';

    projectsData.forEach(project => {
        const projectFolder = project.contentPath
            ? project.contentPath.split('/')[0]
            : (project.thumbnail ? project.thumbnail.split('/')[0] : '');
        const thumbnailUrl = resolveAssetUrl(project.thumbnail, projectFolder, 'assets/icons/w2k_unknown_14.png');

        const shortcut = document.createElement('div');
        shortcut.className = 'project-shortcut';
        shortcut.style.position = 'relative';
        shortcut.innerHTML = `
            <div style="position: relative; width: 150px; height: 150px;">
                <img src="${escapeHtml(thumbnailUrl)}" alt="${escapeHtml(project.title)}" class="sp-smooth-img" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy" />
                <img src="assets/icons/w2k_shortcut_overlay.png" class="pixel-icon" style="position: absolute; left: 0; bottom: 0; width: 16px; height: 16px; pointer-events: none;" />
            </div>
            <div class="project-shortcut-title">${escapeHtml(project.title)}</div>
            <div class="project-shortcut-meta">${escapeHtml(project.type)} | ${escapeHtml(formatYearShort(project.date))}</div>
        `;
        shortcut.addEventListener(eventType, () => showProjectDetail(project));
        grid.appendChild(shortcut);
    });
};

// Render and open Project Detail window
export const showProjectDetail = async (project) => {
    if (!project) return;
    const windowId = `project-detail-${project.id}`;
    let detailWin = document.getElementById(windowId);

    // If window already exists, restore/focus it
    if (detailWin) {
        if (detailWin.style.display === 'none') {
            openWindow(windowId);
        } else {
            bringToFront(detailWin);
        }
        return;
    }

    const projectFolder = project.contentPath
        ? project.contentPath.split('/')[0]
        : (project.thumbnail ? project.thumbnail.split('/')[0] : '');

    // 1. Fetch & parse Markdown description
    let rawDescription = project.description || '';
    if (project.contentPath && !rawDescription) {
        try {
            const fullContentPath = (!project.contentPath.startsWith('http') && !project.contentPath.startsWith('/'))
                ? 'projects/' + project.contentPath
                : project.contentPath;
            const response = await fetch(encodeURI(fullContentPath));
            if (response.ok) {
                rawDescription = await response.text();
            }
        } catch (error) {
            console.error('Error fetching description:', error);
        }
    }

    const { meta, body } = parseProjectMarkdown(rawDescription);

    // Promote non-embed Bandcamp / Instagram links in project.media to CTA buttons
    const rawMediaList = Array.isArray(project.media) ? project.media : [];
    const embeddableMediaList = [];
    rawMediaList.forEach(mediaPath => {
        if (!mediaPath || String(mediaPath).trim().startsWith('//')) return;
        if (mediaPath.includes('bandcamp.com') && !mediaPath.includes('/EmbeddedPlayer/')) {
            const title = mediaPath.split('/').pop().replace(/[-_]/g, ' ').toUpperCase();
            if (!meta.links.some(l => l.url === mediaPath)) {
                meta.links.push({ label: `Bandcamp (${title})`, url: mediaPath });
            }
            return;
        }
        if (mediaPath.includes('instagram.com/')) {
            if (!meta.links.some(l => l.url === mediaPath)) {
                meta.links.push({ label: 'Instagram Reel / Post', url: mediaPath });
            }
            return;
        }
        embeddableMediaList.push(mediaPath);
    });

    const projectWithFilteredMedia = { ...project, media: embeddableMediaList };
    const usedMediaIndices = new Set();

    // 2. Split markdown body into Heading Blocks and render each
    const rawBlocks = splitIntoHeadingBlocks(body);
    const renderedBlocks = [];
    const tocEntries = [];

    rawBlocks.forEach((block, idx) => {
        const expandedMd = expandMediaShortcodes(block.markdown, projectWithFilteredMedia, projectFolder, usedMediaIndices);
        let parsedHtml = '';
        if (expandedMd) {
            if (typeof marked !== 'undefined') {
                parsedHtml = marked.parse(expandedMd);
            } else {
                parsedHtml = expandedMd
                    .split(/\n\n+/)
                    .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
                    .join('');
            }
        }

        const enhancedHtml = enhanceBlockHtml(
            parsedHtml,
            projectWithFilteredMedia,
            projectFolder,
            usedMediaIndices
        );

        const blockId = `${windowId}-${block.id || `sec-${idx + 1}`}`;
        if (block.title) {
            tocEntries.push({ id: blockId, text: block.title });
        }

        renderedBlocks.push({
            id: blockId,
            title: block.title,
            html: enhancedHtml
        });
    });

    // 3. Collect remaining unused media items for Preview Explorer (excluding cover thumbnail)
    const normalizedThumb = project.thumbnail
        ? resolveAssetUrl(project.thumbnail, projectFolder, '').split('?')[0].normalize('NFC').toLowerCase()
        : '';
    const isThumbnailMedia = (mediaPath) => {
        if (!normalizedThumb || !mediaPath) return false;
        const resolvedMedia = resolveAssetUrl(mediaPath, projectFolder, '').split('?')[0].normalize('NFC').toLowerCase();
        return resolvedMedia === normalizedThumb;
    };

    const unusedMediaPaths = embeddableMediaList.filter((mediaPath, idx) => !usedMediaIndices.has(idx) && !isThumbnailMedia(mediaPath));
    const galleryItemsHtml = unusedMediaPaths
        .map(mediaPath => renderGalleryItemHtml(mediaPath, projectWithFilteredMedia, projectFolder))
        .filter(Boolean)
        .join('');

    // 4. Prepare Header Metadata & Spec Rows
    const thumbnailUrl = resolveAssetUrl(project.thumbnail, projectFolder, 'assets/icons/w2k_unknown_14.png');

    let processedRole = project.role || '-';
    if (processedRole && typeof marked !== 'undefined') {
        if (typeof marked.parseInline === 'function') {
            processedRole = marked.parseInline(processedRole);
        } else {
            processedRole = marked.parse(processedRole).replace(/^<p>|<\/p>\s*$/g, '');
        }
    } else if (processedRole) {
        processedRole = escapeHtml(processedRole).replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    }

    const specItems = [];
    if (processedRole && processedRole !== '-') {
        specItems.push({ label: 'Role', valueHtml: processedRole });
    }
    const studioVal = meta.studio || project.studio || '';
    if (studioVal) {
        specItems.push({ label: meta.studioLabel || 'Studio', valueHtml: escapeHtml(studioVal) });
    }
    const formatVal = meta.format || project.type || '';
    if (formatVal) {
        specItems.push({ label: meta.formatLabel || 'Format', valueHtml: escapeHtml(formatVal) });
    }
    const statusOrDate = meta.status || formatDate(project.date);
    if (statusOrDate) {
        specItems.push({ label: 'Date', valueHtml: escapeHtml(statusOrDate) });
    }
    const toolsVal = meta.tools || project.tools || '';
    if (toolsVal) {
        specItems.push({ label: 'Tools', valueHtml: escapeHtml(toolsVal) });
    }

    const specGridHtml = specItems.map(item => `
        <div class="sp-spec-item">
            <span class="sp-spec-label">${escapeHtml(item.label)}:</span>
            <span class="sp-spec-value">${item.valueHtml}</span>
        </div>
    `).join('');

    const ctaButtonsHtml = meta.links.length > 0
        ? `<div class="sp-cta-row">
            ${meta.links.map((link, idx) => {
                const resolvedHref = resolveActionUrl(link.url);
                const isExternal = resolvedHref.startsWith('http');
                const arrow = isExternal ? ' ↗' : ' →';
                return `<a href="${escapeHtml(resolvedHref)}" ${isExternal ? 'target="_blank" rel="noopener"' : ''} class="sp-cta-btn ${idx === 0 ? 'sp-cta-primary' : ''}">${escapeHtml(link.label)}${arrow}</a>`;
            }).join('')}
           </div>`
        : '';

    // 5. Prepare Reader Content Sections (Subtitle, Metrics, Highlights, Pipeline, Heading Blocks)
    const subtitleHtml = meta.subtitle
        ? `<div class="sp-subtitle-banner">
            ${typeof marked !== 'undefined' && typeof marked.parseInline === 'function' ? marked.parseInline(meta.subtitle) : escapeHtml(meta.subtitle)}
           </div>`
        : '';

    const statsList = meta.stats.length > 0 ? meta.stats : (project.stats || []);
    const metricsHtml = statsList.length > 0
        ? `<div class="sp-metrics-strip">
            ${statsList.map(stat => {
                const parts = String(stat).split('|').map(s => s.trim());
                const val = parts[0] || '';
                const lbl = parts[1] || '';
                return `
                    <div class="sp-metric-cell">
                        <div class="sp-metric-value">${escapeHtml(val)}</div>
                        ${lbl ? `<div class="sp-metric-label">${escapeHtml(lbl)}</div>` : ''}
                    </div>
                `;
            }).join('')}
           </div>`
        : '';

    const highlightsList = meta.highlights.length > 0 ? meta.highlights : (project.highlights || []);
    const highlightsHtml = highlightsList.length > 0
        ? `<div class="sp-highlights-card">
            <div class="sp-section-eyebrow">Highlights</div>
            <ul class="sp-highlights-list">
                ${highlightsList.map(item => `<li>${typeof marked !== 'undefined' && typeof marked.parseInline === 'function' ? marked.parseInline(item) : escapeHtml(item)}</li>`).join('')}
            </ul>
           </div>`
        : '';

    const pipelineList = meta.pipeline.length > 0 ? meta.pipeline : (project.pipeline || []);
    const pipelineHtml = pipelineList.length > 0
        ? `<div class="sp-pipeline-grid">
            ${pipelineList.map((step, i) => {
                const parts = String(step).split('|').map(s => s.trim());
                const stepTitle = parts[0] || `Step ${i + 1}`;
                const stepDesc = parts[1] || '';
                return `
                    <div class="sp-pipeline-card">
                        <span class="sp-pipeline-index">0${i + 1}</span>
                        <strong class="sp-pipeline-title">${escapeHtml(stepTitle)}</strong>
                        ${stepDesc ? `<span class="sp-pipeline-desc">${escapeHtml(stepDesc)}</span>` : ''}
                    </div>
                `;
            }).join('')}
           </div>`
        : '';

    let titledCounter = 0;
    const blocksHtml = renderedBlocks.map(block => {
        const idxBadge = block.title ? String(++titledCounter).padStart(2, '0') : '';
        return `
            <section id="${escapeHtml(block.id)}" class="sp-heading-block">
                ${block.title ? `
                    <header class="sp-heading-block-header">
                        <span class="sp-heading-block-index">${idxBadge}</span>
                        <h3 class="sp-heading-block-title">${escapeHtml(block.title)}</h3>
                    </header>
                ` : ''}
                <div class="sp-prose">
                    ${block.html}
                </div>
            </section>
        `;
    }).join('');

    const tocBarHtml = tocEntries.length > 1
        ? `<div class="sp-toc-bar">
            <span class="sp-toc-label">Jump to:</span>
            ${tocEntries.map((item, i) => `
                <button type="button" class="sp-toc-chip" data-target="${escapeHtml(item.id)}">
                    ${String(i + 1).padStart(2, '0')} ${escapeHtml(item.text)}
                </button>
            `).join('')}
           </div>`
        : '';

    const hasReaderContent = Boolean(subtitleHtml || metricsHtml || highlightsHtml || pipelineHtml || blocksHtml.trim());
    const readerBodyHtml = hasReaderContent
        ? `${subtitleHtml}${metricsHtml}${highlightsHtml}${pipelineHtml}${blocksHtml}`
        : '<p style="color: #666;">No additional written notes for this project.</p>';

    // 6. Create Window Element
    detailWin = document.createElement('div');
    detailWin.className = 'window sp-detail-window';
    detailWin.id = windowId;
    detailWin.dataset.display = 'flex';
    detailWin.style.width = unusedMediaPaths.length > 0 ? '920px' : '760px';
    detailWin.style.height = '640px';
    detailWin.style.maxWidth = '96vw';
    detailWin.style.maxHeight = '90vh';
    detailWin.style.display = 'none';
    detailWin.style.flexDirection = 'column';

    detailWin.innerHTML = `
        <div class="title-bar" style="flex-shrink: 0;">
            <div class="title-bar-text">
                <img src="assets/icons/w2k_unknown_14.png" class="pixel-icon" style="width: 16px; height: 16px; margin-right: 4px; vertical-align: middle;">
                ${escapeHtml(project.title)}
            </div>
            <div class="title-bar-controls">
                <button class="minimize-btn" aria-label="Minimize"></button>
                <button class="close-btn" aria-label="Close"></button>
            </div>
        </div>
        <div class="window-body sp-detail-body">
            <!-- Header Section -->
            <div class="sp-detail-header">
                <div class="sunken-panel sp-detail-thumb sp-expandable-media" data-media-src="${escapeHtml(thumbnailUrl)}" data-media-title="${escapeHtml(project.title)}" title="Click to enlarge cover">
                    <img src="${escapeHtml(thumbnailUrl)}" alt="${escapeHtml(project.title)}" class="sp-smooth-img">
                </div>
                <div class="sp-detail-meta">
                    <div class="sp-detail-overline">${escapeHtml(project.type || 'Project')} | ${escapeHtml(formatYearShort(project.date))}</div>
                    <h2 class="sp-detail-title">
                        <img src="assets/icons/w2k_unknown_14.png" class="pixel-icon" style="width: 18px; height: 18px;">
                        <span>${escapeHtml(project.title)}</span>
                    </h2>
                    <div class="sp-spec-grid">
                        ${specGridHtml}
                    </div>
                    ${ctaButtonsHtml}
                </div>
            </div>

            <!-- Main Workspace Section -->
            <div class="sp-workspace">
                <!-- Case Study Reader (Left) -->
                <div class="sunken-panel sp-reader-panel">
                    <ul class="menubar sp-reader-menubar">
                        <li><span style="text-decoration: underline;">F</span>ile</li>
                        <li><span style="text-decoration: underline;">E</span>dit</li>
                        <li><span style="text-decoration: underline;">V</span>iew</li>
                        <li><span style="text-decoration: underline;">H</span>elp</li>
                    </ul>
                    ${tocBarHtml}
                    <div class="markdown-content sp-reader-content">
                        ${readerBodyHtml}
                    </div>
                    <div class="sp-reader-statusbar">
                        <span>UTF-8 | ${Math.max(1, renderedBlocks.length)} Section${renderedBlocks.length === 1 ? '' : 's'}</span>
                        <span>Click any image to expand</span>
                    </div>
                </div>

                ${unusedMediaPaths.length > 0 ? `
                <!-- Preview Explorer / Media Gallery (Right) -->
                <div class="sunken-panel sp-gallery-panel">
                    <div class="sp-gallery-header">
                        <span>Preview Explorer</span>
                        <span class="sp-gallery-count">${unusedMediaPaths.length} item${unusedMediaPaths.length === 1 ? '' : 's'}</span>
                    </div>
                    <div class="project-media-container sp-gallery-list">
                        ${galleryItemsHtml}
                    </div>
                </div>
                ` : ''}
            </div>

            <!-- Status Bar / Footer -->
            <div class="status-bar sp-detail-statusbar">
                <p class="status-bar-field" style="flex: 2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Tags: ${escapeHtml((project.tags || []).join(' '))}</p>
                <p class="status-bar-field" style="flex: 1; text-align: right;">ID: ${escapeHtml(project.id)}</p>
            </div>
        </div>
    `;

    document.body.appendChild(detailWin);

    // Focus window on mousedown
    detailWin.addEventListener('mousedown', () => bringToFront(detailWin));

    // Close & Minimize button handlers (properly integrated with taskbar)
    const closeBtn = detailWin.querySelector('.close-btn');
    if (closeBtn) {
        closeBtn.onclick = () => {
            closeWindow(detailWin);
            detailWin.remove();
        };
    }

    const minimizeBtn = detailWin.querySelector('.minimize-btn');
    if (minimizeBtn) {
        minimizeBtn.onclick = () => {
            minimizeWindow(detailWin);
        };
    }

    // TOC quick-jump buttons inside reader
    const readerScrollEl = detailWin.querySelector('.sp-reader-content');
    detailWin.querySelectorAll('.sp-toc-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const targetId = chip.getAttribute('data-target');
            const targetEl = detailWin.querySelector(`#${CSS.escape(targetId)}`);
            if (targetEl && readerScrollEl) {
                const top = targetEl.offsetTop - readerScrollEl.offsetTop - 8;
                readerScrollEl.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
            }
        });
    });

    // Intercept links to other portfolio projects so they open directly inside SidePortfolio if available
    detailWin.querySelectorAll('a[href]').forEach(link => {
        const href = link.getAttribute('href') || '';
        const projMatch = href.match(/uluckaymak\.com\/projects\/([a-zA-Z0-9_-]+)/i) || href.match(/^\/projects\/([a-zA-Z0-9_-]+)/i);
        if (projMatch && projMatch[1]) {
            const targetProj = projectsData.find(p => p.id === projMatch[1]);
            if (targetProj) {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    showProjectDetail(targetProj);
                });
            }
        }
    });

    // Collect all expandable images in visual order for gallery navigation in Media Viewer
    const galleryImagesList = [];
    detailWin.querySelectorAll('.sp-expandable-media').forEach(el => {
        const src = el.getAttribute('data-media-src') || el.getAttribute('data-src');
        const title = el.getAttribute('data-media-title') || el.getAttribute('data-title') || project.title;
        if (src && !galleryImagesList.some(item => item.src === src)) {
            galleryImagesList.push({ src, title });
        }
    });

    // Click handler for any expandable image or video item (thumbnail, inline @media/markdown image, or Preview Explorer item)
    detailWin.addEventListener('click', (e) => {
        if (e.target.tagName === 'AUDIO' || e.target.tagName === 'IFRAME' || e.target.closest('a')) return;

        const expandable = e.target.closest('.sp-expandable-media, .project-media-item');
        if (expandable) {
            // Don't hijack clicks on inline <video controls> inside the reader
            if (e.target.tagName === 'VIDEO' && !expandable.classList.contains('project-media-item')) return;
            const src = expandable.getAttribute('data-media-src') || expandable.getAttribute('data-src');
            const title = expandable.getAttribute('data-media-title') || expandable.getAttribute('data-title') || project.title;
            if (src) {
                openMediaWindow(src, title, galleryImagesList);
            }
        }
    });

    // Open and setup dragging/resizing
    openWindow(windowId);
    setupDragging(detailWin);
    setupResizing(detailWin);
};

// Opens an image, video, or audio file in a dedicated Win98/2K viewer window (with Prev/Next support for images)
const openMediaWindow = (src, title, imageList = []) => {
    const lowerSrc = src.toLowerCase().split('?')[0];
    const isVideo = lowerSrc.endsWith('.mp4') || lowerSrc.endsWith('.mov') || lowerSrc.endsWith('.webm');
    const isAudio = lowerSrc.endsWith('.mp3') || lowerSrc.endsWith('.wav') || lowerSrc.endsWith('.ogg');

    const mediaWin = document.createElement('div');
    mediaWin.className = 'window sp-media-viewer';
    mediaWin.style.position = 'absolute';
    mediaWin.style.width = 'auto';
    mediaWin.style.height = 'auto';
    mediaWin.style.maxWidth = '90vw';
    mediaWin.style.maxHeight = '90vh';

    let currentIdx = imageList.findIndex(item => item.src === src);
    const hasGalleryNav = !isVideo && !isAudio && imageList.length > 1 && currentIdx !== -1;

    let cleanTitle = title || '';
    try {
        cleanTitle = decodeURIComponent(cleanTitle);
    } catch (e) {}

    let mediaContent = '';
    if (isVideo) {
        mediaContent = `<video src="${escapeHtml(src)}" controls style="display: block; max-width: 85vw; max-height: 78vh;" autoplay playsinline></video>`;
    } else if (isAudio) {
        mediaContent = `
            <div style="padding: 30px; background: silver; display: flex; flex-direction: column; align-items: center; gap: 20px; width: 380px; max-width: 80vw;">
                <img src="assets/icons/w2k_audio_cd.png" class="pixel-icon" style="width: 64px; height: 64px;" />
                <audio src="${escapeHtml(src)}" controls style="width: 100%;" autoplay></audio>
                <div style="font-size: 11px; color: black; font-weight: bold; text-align: center;">${escapeHtml(cleanTitle)}</div>
            </div>`;
    } else {
        mediaContent = `<img src="${escapeHtml(src)}" alt="${escapeHtml(cleanTitle)}" class="sp-smooth-img sp-viewer-img" style="display: block; max-width: 85vw; max-height: 75vh; object-fit: contain;" />`;
    }

    const navBarHtml = hasGalleryNav
        ? `<div class="status-bar sp-viewer-statusbar" style="align-items: center; justify-content: space-between; padding: 3px 4px; gap: 6px;">
            <button type="button" class="sp-viewer-prev" style="min-width: 64px; min-height: 22px; font-size: 11px;">&larr; Prev</button>
            <p class="status-bar-field sp-viewer-counter" style="text-align: center; font-size: 11px;">${escapeHtml(cleanTitle)} (${currentIdx + 1} / ${imageList.length})</p>
            <button type="button" class="sp-viewer-next" style="min-width: 64px; min-height: 22px; font-size: 11px;">Next &rarr;</button>
           </div>`
        : '';

    mediaWin.innerHTML = `
        <div class="title-bar">
            <div class="title-bar-text sp-viewer-title">${escapeHtml(cleanTitle)}</div>
            <div class="title-bar-controls">
                <button class="close-btn" aria-label="Close"></button>
            </div>
        </div>
        <div class="window-body" style="padding: 8px; overflow: auto; background: #0a0a0a; display: flex; justify-content: center; align-items: center;">
            ${mediaContent}
        </div>
        ${navBarHtml}
    `;

    document.body.appendChild(mediaWin);

    const setPosition = () => {
        const winWidth = mediaWin.offsetWidth;
        const winHeight = mediaWin.offsetHeight;
        mediaWin.style.left = `${Math.max(10, (window.innerWidth - winWidth) / 2)}px`;
        mediaWin.style.top = `${Math.max(10, (window.innerHeight - winHeight) / 2)}px`;
    };

    const mediaElement = mediaWin.querySelector('img, video, audio');
    if (mediaElement) {
        if (mediaElement.tagName === 'IMG') {
            mediaElement.onload = setPosition;
        } else if (mediaElement.tagName === 'VIDEO') {
            mediaElement.onloadedmetadata = setPosition;
        } else if (mediaElement.tagName === 'AUDIO') {
            setTimeout(setPosition, 50);
        }
    }
    setTimeout(setPosition, 100);

    bringToFront(mediaWin);
    mediaWin.addEventListener('mousedown', () => bringToFront(mediaWin));

    const updateGallerySlide = (dir) => {
        if (!hasGalleryNav) return;
        currentIdx = (currentIdx + dir + imageList.length) % imageList.length;
        const item = imageList[currentIdx];
        const imgEl = mediaWin.querySelector('.sp-viewer-img');
        const titleEl = mediaWin.querySelector('.sp-viewer-title');
        const counterEl = mediaWin.querySelector('.sp-viewer-counter');
        if (imgEl && item) {
            imgEl.src = item.src;
            imgEl.alt = item.title || '';
        }
        if (titleEl && item) {
            titleEl.textContent = item.title || '';
        }
        if (counterEl && item) {
            counterEl.textContent = `${item.title || ''} (${currentIdx + 1} / ${imageList.length})`;
        }
    };

    if (hasGalleryNav) {
        const prevBtn = mediaWin.querySelector('.sp-viewer-prev');
        const nextBtn = mediaWin.querySelector('.sp-viewer-next');
        if (prevBtn) prevBtn.addEventListener('click', () => updateGallerySlide(-1));
        if (nextBtn) nextBtn.addEventListener('click', () => updateGallerySlide(1));
    }

    const onKeyDown = (e) => {
        if (!document.body.contains(mediaWin)) {
            document.removeEventListener('keydown', onKeyDown);
            return;
        }
        if (!mediaWin.classList.contains('active')) return;
        if (e.key === 'Escape') {
            mediaWin.remove();
            document.removeEventListener('keydown', onKeyDown);
        } else if (hasGalleryNav && e.key === 'ArrowLeft') {
            updateGallerySlide(-1);
        } else if (hasGalleryNav && e.key === 'ArrowRight') {
            updateGallerySlide(1);
        }
    };
    document.addEventListener('keydown', onKeyDown);

    mediaWin.querySelector('.close-btn').addEventListener('click', () => {
        document.removeEventListener('keydown', onKeyDown);
        mediaWin.remove();
    });

    setupDragging(mediaWin);
    setupResizing(mediaWin);
};

// Expose globally for other modules (e.g. portfolio.js SmartSearch)
window.showProjectDetail = showProjectDetail;

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', loadProjects);
