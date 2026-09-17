// paint.js
// Self-contained MS Paint-style clone for the #paint window.
// (jspaint could not be vendored here: the sandbox's network allowlist blocks
// github raw/codeload/jspaint.app, and a full git clone of the repo does not
// finish inside the tool's 45s-per-call budget. This is a from-scratch
// canvas implementation matching the classic 16-tool toolbox layout instead.)

import { openWindow, closeWindow, bringToFront, setupDragging, setupResizing } from './windows.js';

// ---------------- "My Pictures" gallery (localStorage-backed) ----------------
// This is a static site with no backend to write files to, so "saving to a
// folder" is implemented as an in-browser virtual folder: PNGs are stored as
// data URLs in localStorage and listed in the #my-pictures window.

const GALLERY_KEY = 'paint_gallery_v1';
const GALLERY_MAX_ITEMS = 24;

const getGallery = () => {
    try {
        const raw = localStorage.getItem(GALLERY_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (err) {
        return [];
    }
};

const setGallery = (items) => {
    try {
        localStorage.setItem(GALLERY_KEY, JSON.stringify(items));
    } catch (err) {
        // localStorage full or unavailable — fail silently, drawing still works
    }
};

const addToGallery = (dataUrl) => {
    const items = getGallery();
    items.unshift({ id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`, dataUrl, timestamp: Date.now() });
    while (items.length > GALLERY_MAX_ITEMS) items.pop();
    setGallery(items);
    renderGallery();
};

const deleteFromGallery = (id) => {
    setGallery(getGallery().filter((item) => item.id !== id));
    renderGallery();
};

const formatTimestamp = (ts) => new Date(ts).toLocaleString();

const renderGallery = () => {
    const grid = document.getElementById('my-pictures-grid');
    const countEl = document.getElementById('my-pictures-count');
    if (!grid) return;
    const items = getGallery();
    if (countEl) countEl.textContent = String(items.length);

    grid.innerHTML = '';
    if (!items.length) {
        const empty = document.createElement('p');
        empty.style.padding = '12px';
        empty.style.color = '#555';
        empty.textContent = "Henüz kayıtlı resim yok. Paint'te bir şeyler çiz ve \"Save as PNG\" de.";
        grid.appendChild(empty);
        return;
    }

    items.forEach((item) => {
        const tile = document.createElement('div');
        tile.className = 'project-shortcut';
        tile.dataset.id = item.id;
        tile.innerHTML = `
            <img src="${item.dataUrl}" alt="Saved painting" style="background:#fff;"/>
            <span>${formatTimestamp(item.timestamp)}</span>
        `;
        tile.addEventListener('dblclick', () => openPictureViewer(item));
        grid.appendChild(tile);
    });
};

const watchGalleryWindowVisibility = () => {
    const win = document.getElementById('my-pictures');
    if (!win) return;
    renderGallery();
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((m) => {
            if (m.attributeName === 'style' && win.style.display !== 'none') renderGallery();
        });
    });
    observer.observe(win, { attributes: true });
};

const openPictureViewer = (item) => {
    const existing = document.getElementById(`picview-${item.id}`);
    if (existing) { bringToFront(existing); return; }

    const win = document.createElement('div');
    win.className = 'window';
    win.id = `picview-${item.id}`;
    win.style.position = 'absolute';
    win.style.width = '360px';
    win.style.left = `${Math.max(0, (window.innerWidth - 360) / 2 + (Math.random() * 60 - 30))}px`;
    win.style.top = `${Math.max(0, (window.innerHeight - 360) / 2 + (Math.random() * 60 - 30))}px`;

    win.innerHTML = `
        <div class="title-bar">
            <div class="title-bar-text">${formatTimestamp(item.timestamp)}.png</div>
            <div class="title-bar-controls">
                <button class="minimize-btn" aria-label="Minimize"></button>
                <button class="close-btn" aria-label="Close"></button>
            </div>
        </div>
        <div class="window-body">
            <img src="${item.dataUrl}" alt="Saved painting" style="width:100%; height:auto; background:#fff; display:block;"/>
            <div style="display:flex; gap:6px; margin-top:8px;">
                <button type="button" class="picview-open">Open in Paint</button>
                <button type="button" class="picview-download">Download</button>
                <button type="button" class="picview-delete">Delete</button>
            </div>
        </div>
    `;
    document.body.appendChild(win);
    bringToFront(win);
    setupDragging(win);
    setupResizing(win);

    win.querySelector('.close-btn').addEventListener('click', () => win.remove());
    win.querySelector('.picview-download').addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = `uluc-paint-${item.id}.png`;
        link.href = item.dataUrl;
        link.click();
    });
    win.querySelector('.picview-delete').addEventListener('click', () => {
        deleteFromGallery(item.id);
        win.remove();
    });
    win.querySelector('.picview-open').addEventListener('click', () => {
        loadImageIntoCanvas(item.dataUrl);
        openWindow('paint');
    });
};

const loadImageIntoCanvas = (dataUrl) => {
    const img = new Image();
    img.onload = () => {
        pushHistory();
        baseCtx.fillStyle = '#ffffff';
        baseCtx.fillRect(0, 0, base.width, base.height);
        baseCtx.drawImage(img, 0, 0, base.width, base.height);
        setStatus('Loaded from My Pictures.');
    };
    img.src = dataUrl;
};

const TOOL_LABELS = {
    lasso: 'Free-Form Select',
    select: 'Select',
    eraser: 'Eraser',
    fill: 'Fill With Color',
    eyedropper: 'Pick Color',
    zoom: 'Magnifier',
    pencil: 'Pencil',
    brush: 'Brush',
    airbrush: 'Airbrush',
    text: 'Text',
    line: 'Line',
    curve: 'Curve',
    rect: 'Rectangle',
    polygon: 'Polygon',
    ellipse: 'Ellipse',
    roundrect: 'Rounded Rectangle',
};

const PALETTE = [
    '#000000', '#7f7f7f', '#880015', '#ed1c24', '#ff7f27', '#fff200', '#22b14c', '#00a2e8', '#3f48cc', '#a349a4', '#ff8fcf', '#b28dff', '#6d4c1f', '#000080',
    '#ffffff', '#c3c3c3', '#b97a57', '#ffaec9', '#ffc90e', '#efe4b0', '#b5e61d', '#99d9ea', '#7092be', '#c8bfe7', '#baf2ff', '#e6c9ff', '#a89e8c', '#5b6ee1',
];

let base, baseCtx, overlay, overlayCtx, canvasWrap;
let optionsEl, statusEl, coordsEl, zoomFieldEl;
let primarySwatchEl, secondarySwatchEl, colorPickerEl;

const state = {
    tool: 'select',
    primary: '#000000',
    secondary: '#ffffff',
    size: 4,
    shape: 'round',
    isPointerDown: false,
    button: 0,
    startPos: null,
    lastPos: null,
    selection: null, // {x,y,w,h,path?}
    movingSelection: false,
    moveOffset: null,
    moveBuffer: null, // {canvas, w, h}
    history: [],
    redoStack: [],
    zoomLevel: 1,
};

let lassoPoints = null;
let curveState = null; // null | {p0, p1}
let polygonState = null; // null | {points:[...]}

const ZOOM_LEVELS = [1, 2, 4];

// ---------------- utility ----------------

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const getCanvasPos = (e) => {
    const rect = overlay.getBoundingClientRect();
    const scaleX = overlay.width / rect.width;
    const scaleY = overlay.height / rect.height;
    const point = e.touches && e.touches.length ? e.touches[0] : e;
    return {
        x: clamp(Math.round((point.clientX - rect.left) * scaleX), 0, overlay.width),
        y: clamp(Math.round((point.clientY - rect.top) * scaleY), 0, overlay.height),
    };
};

const clearOverlay = () => overlayCtx.clearRect(0, 0, overlay.width, overlay.height);

const drawDashedRect = (x, y, w, h) => {
    overlayCtx.save();
    overlayCtx.strokeStyle = '#000';
    overlayCtx.lineWidth = 1;
    overlayCtx.setLineDash([4, 3]);
    overlayCtx.strokeRect(x + 0.5, y + 0.5, w, h);
    overlayCtx.restore();
};

const drawDashedPath = (points, offsetX = 0, offsetY = 0, close = false) => {
    if (!points.length) return;
    overlayCtx.save();
    overlayCtx.strokeStyle = '#000';
    overlayCtx.lineWidth = 1;
    overlayCtx.setLineDash([4, 3]);
    overlayCtx.beginPath();
    overlayCtx.moveTo(points[0].x + offsetX, points[0].y + offsetY);
    for (let i = 1; i < points.length; i++) overlayCtx.lineTo(points[i].x + offsetX, points[i].y + offsetY);
    if (close) overlayCtx.closePath();
    overlayCtx.stroke();
    overlayCtx.restore();
};

// ---------------- history (undo/redo) ----------------

const pushHistory = () => {
    try {
        state.history.push(baseCtx.getImageData(0, 0, base.width, base.height));
        if (state.history.length > 20) state.history.shift();
        state.redoStack.length = 0;
    } catch (err) { /* ignore */ }
};

const undo = () => {
    if (!state.history.length) return;
    state.redoStack.push(baseCtx.getImageData(0, 0, base.width, base.height));
    baseCtx.putImageData(state.history.pop(), 0, 0);
    setStatus('Undo.');
};

const redo = () => {
    if (!state.redoStack.length) return;
    state.history.push(baseCtx.getImageData(0, 0, base.width, base.height));
    baseCtx.putImageData(state.redoStack.pop(), 0, 0);
    setStatus('Redo.');
};

// ---------------- status bar ----------------

const setStatus = (text) => { if (statusEl) statusEl.textContent = text; };
const updateCoords = (pos) => { if (coordsEl) coordsEl.textContent = `${pos.x}, ${pos.y}`; };

// ---------------- color ----------------

const setPrimary = (hex) => { state.primary = hex; primarySwatchEl.style.background = hex; };
const setSecondary = (hex) => { state.secondary = hex; secondarySwatchEl.style.background = hex; };

const rgbToHex = (r, g, b) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

const pickColor = (pos, button) => {
    const d = baseCtx.getImageData(pos.x, pos.y, 1, 1).data;
    const hex = rgbToHex(d[0], d[1], d[2]);
    if (button === 2) setSecondary(hex); else setPrimary(hex);
    setStatus(`Picked ${hex}.`);
};

const buildPalette = () => {
    const container = document.getElementById('paint-palette');
    PALETTE.forEach((hex) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'paint-palette-swatch';
        btn.style.background = hex;
        btn.title = hex;
        btn.addEventListener('click', () => setPrimary(hex));
        btn.addEventListener('contextmenu', (e) => { e.preventDefault(); setSecondary(hex); });
        container.appendChild(btn);
    });
};

// ---------------- zoom ----------------

const applyZoom = () => {
    const w = base.width * state.zoomLevel;
    const h = base.height * state.zoomLevel;
    [base, overlay].forEach((c) => {
        c.style.width = `${w}px`;
        c.style.height = `${h}px`;
        c.style.imageRendering = state.zoomLevel > 1 ? 'pixelated' : 'auto';
    });
    const container = document.getElementById('paint-canvas-container');
    if (container) {
        container.style.width = `${w}px`;
        container.style.height = `${h}px`;
    }
    if (zoomFieldEl) zoomFieldEl.textContent = `${state.zoomLevel * 100}%`;
};

const cycleZoom = () => {
    const idx = ZOOM_LEVELS.indexOf(state.zoomLevel);
    state.zoomLevel = ZOOM_LEVELS[(idx + 1) % ZOOM_LEVELS.length];
    applyZoom();
    setStatus(`Zoom: ${state.zoomLevel * 100}%`);
};

const zoomIn = () => { const i = ZOOM_LEVELS.indexOf(state.zoomLevel); state.zoomLevel = ZOOM_LEVELS[Math.min(i + 1, ZOOM_LEVELS.length - 1)]; applyZoom(); };
const zoomOut = () => { const i = ZOOM_LEVELS.indexOf(state.zoomLevel); state.zoomLevel = ZOOM_LEVELS[Math.max(i - 1, 0)]; applyZoom(); };
const zoomReset = () => { state.zoomLevel = 1; applyZoom(); };

// ---------------- freehand drawing ----------------

const paintStroke = (pos, isStart) => {
    const color = state.button === 2 ? state.secondary : state.primary;
    let drawColor = color;
    let size = state.size;
    let cap = state.shape || 'round';

    if (state.tool === 'pencil') size = 1;
    if (state.tool === 'eraser') { drawColor = state.secondary; size = Math.max(size, 8); cap = 'square'; }
    if (state.tool === 'airbrush') { sprayDots(pos, drawColor, size); return; }

    baseCtx.strokeStyle = drawColor;
    baseCtx.fillStyle = drawColor;
    baseCtx.lineWidth = size;
    baseCtx.lineCap = cap;
    baseCtx.lineJoin = cap === 'square' ? 'miter' : 'round';

    if (isStart) {
        if (cap === 'square') {
            baseCtx.fillRect(pos.x - size/2, pos.y - size/2, size, size);
        } else {
            baseCtx.beginPath();
            baseCtx.arc(pos.x, pos.y, size / 2, 0, Math.PI * 2);
            baseCtx.fill();
        }
    } else {
        baseCtx.beginPath();
        baseCtx.moveTo(state.lastPos.x, state.lastPos.y);
        baseCtx.lineTo(pos.x, pos.y);
        baseCtx.stroke();
    }
};

const sprayDots = (pos, color, size) => {
    baseCtx.fillStyle = color;
    const radius = Math.max(size, 6) * 1.4;
    for (let i = 0; i < 10; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * radius;
        baseCtx.fillRect(pos.x + Math.cos(angle) * dist, pos.y + Math.sin(angle) * dist, 1, 1);
    }
};

// ---------------- flood fill ----------------

const floodFill = (x, y, fillHex) => {
    const w = base.width, h = base.height;
    const imgData = baseCtx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const startIdx = (y * w + x) * 4;
    const startR = data[startIdx], startG = data[startIdx + 1], startB = data[startIdx + 2], startA = data[startIdx + 3];
    const fr = parseInt(fillHex.slice(1, 3), 16), fg = parseInt(fillHex.slice(3, 5), 16), fb = parseInt(fillHex.slice(5, 7), 16);
    if (startR === fr && startG === fg && startB === fb && startA === 255) return;

    const tolerance = 32 * 32;
    const matches = (idx) => {
        const dr = data[idx] - startR, dg = data[idx + 1] - startG, db = data[idx + 2] - startB, da = data[idx + 3] - startA;
        return (dr * dr + dg * dg + db * db + da * da) <= tolerance;
    };

    const visited = new Uint8Array(w * h);
    const stack = [[x, y]];
    while (stack.length) {
        const [cx, cy] = stack.pop();
        if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
        const vIdx = cy * w + cx;
        if (visited[vIdx]) continue;
        const idx = vIdx * 4;
        if (!matches(idx)) continue;
        visited[vIdx] = 1;
        data[idx] = fr; data[idx + 1] = fg; data[idx + 2] = fb; data[idx + 3] = 255;
        stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    baseCtx.putImageData(imgData, 0, 0);
};

// ---------------- shapes (line / rect / ellipse / roundrect) ----------------

const buildShapePath = (ctx, startPos, pos) => {
    ctx.beginPath();
    if (state.tool === 'line') {
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(pos.x, pos.y);
    } else if (state.tool === 'rect' || state.tool === 'roundrect') {
        const x = Math.min(startPos.x, pos.x);
        const y = Math.min(startPos.y, pos.y);
        const w = Math.abs(pos.x - startPos.x);
        const h = Math.abs(pos.y - startPos.y);
        if (state.tool === 'roundrect' && ctx.roundRect) {
            ctx.roundRect(x, y, w, h, Math.min(16, w / 3, h / 3));
        } else {
            ctx.rect(x, y, w, h);
        }
    } else if (state.tool === 'ellipse') {
        const cx = (startPos.x + pos.x) / 2;
        const cy = (startPos.y + pos.y) / 2;
        const rx = Math.abs(pos.x - startPos.x) / 2;
        const ry = Math.abs(pos.y - startPos.y) / 2;
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    }
};

const previewShape = (pos) => {
    clearOverlay();
    overlayCtx.strokeStyle = state.button === 2 ? state.secondary : state.primary;
    overlayCtx.lineWidth = state.size;
    overlayCtx.lineCap = 'round';
    buildShapePath(overlayCtx, state.startPos, pos);
    overlayCtx.stroke();
};

const commitShape = (pos) => {
    baseCtx.strokeStyle = state.button === 2 ? state.secondary : state.primary;
    baseCtx.lineWidth = state.size;
    baseCtx.lineCap = 'round';
    buildShapePath(baseCtx, state.startPos, pos);
    baseCtx.stroke();
    clearOverlay();
};

// ---------------- curve (line, then bend) ----------------

const handleCurveDown = (pos) => {
    if (!curveState) {
        pushHistory();
        curveState = { p0: pos };
    } else if (!curveState.p1) {
        curveState.p1 = pos;
    } else {
        curveState.bending = true;
    }
};

const handleCurveMove = (pos) => {
    if (!curveState) return;
    if (!curveState.p1) {
        clearOverlay();
        overlayCtx.strokeStyle = state.primary;
        overlayCtx.lineWidth = state.size;
        overlayCtx.beginPath();
        overlayCtx.moveTo(curveState.p0.x, curveState.p0.y);
        overlayCtx.lineTo(pos.x, pos.y);
        overlayCtx.stroke();
    } else if (curveState.bending) {
        clearOverlay();
        overlayCtx.strokeStyle = state.primary;
        overlayCtx.lineWidth = state.size;
        overlayCtx.beginPath();
        overlayCtx.moveTo(curveState.p0.x, curveState.p0.y);
        overlayCtx.quadraticCurveTo(pos.x, pos.y, curveState.p1.x, curveState.p1.y);
        overlayCtx.stroke();
    }
};

const handleCurveUp = (pos) => {
    if (curveState && curveState.bending) {
        baseCtx.strokeStyle = state.primary;
        baseCtx.lineWidth = state.size;
        baseCtx.lineCap = 'round';
        baseCtx.beginPath();
        baseCtx.moveTo(curveState.p0.x, curveState.p0.y);
        baseCtx.quadraticCurveTo(pos.x, pos.y, curveState.p1.x, curveState.p1.y);
        baseCtx.stroke();
        clearOverlay();
        curveState = null;
    }
};

// ---------------- polygon (click points, dblclick to close) ----------------

const handlePolygonDown = (pos) => {
    if (!polygonState) polygonState = { points: [pos] };
    else polygonState.points.push(pos);
};

const handlePolygonMove = (pos) => {
    if (!polygonState) return;
    clearOverlay();
    overlayCtx.strokeStyle = state.primary;
    overlayCtx.lineWidth = state.size;
    overlayCtx.beginPath();
    overlayCtx.moveTo(polygonState.points[0].x, polygonState.points[0].y);
    for (let i = 1; i < polygonState.points.length; i++) overlayCtx.lineTo(polygonState.points[i].x, polygonState.points[i].y);
    overlayCtx.lineTo(pos.x, pos.y);
    overlayCtx.stroke();
};

const finalizePolygon = () => {
    if (!polygonState || polygonState.points.length < 2) { polygonState = null; clearOverlay(); return; }
    pushHistory();
    baseCtx.strokeStyle = state.primary;
    baseCtx.lineWidth = state.size;
    baseCtx.lineJoin = 'round';
    baseCtx.beginPath();
    baseCtx.moveTo(polygonState.points[0].x, polygonState.points[0].y);
    for (let i = 1; i < polygonState.points.length; i++) baseCtx.lineTo(polygonState.points[i].x, polygonState.points[i].y);
    baseCtx.closePath();
    baseCtx.stroke();
    clearOverlay();
    polygonState = null;
};

// ---------------- selection: rectangle + lasso, with move ----------------

const isInsideSelectionBox = (pos) => {
    const s = state.selection;
    return s && pos.x >= s.x && pos.x <= s.x + s.w && pos.y >= s.y && pos.y <= s.y + s.h;
};

const startMoveSelection = (pos) => {
    const s = state.selection;
    let tmp = document.createElement('canvas');
    tmp.width = s.w; tmp.height = s.h;
    const tctx = tmp.getContext('2d');

    if (s.path) {
        tctx.beginPath();
        tctx.moveTo(s.path[0].x, s.path[0].y);
        for (let i = 1; i < s.path.length; i++) tctx.lineTo(s.path[i].x, s.path[i].y);
        tctx.closePath();
        tctx.clip();
        tctx.drawImage(base, -s.x, -s.y);

        baseCtx.save();
        baseCtx.beginPath();
        baseCtx.moveTo(s.x + s.path[0].x, s.y + s.path[0].y);
        for (let i = 1; i < s.path.length; i++) baseCtx.lineTo(s.x + s.path[i].x, s.y + s.path[i].y);
        baseCtx.closePath();
        baseCtx.clip();
        baseCtx.fillStyle = '#ffffff';
        baseCtx.fillRect(s.x, s.y, s.w, s.h);
        baseCtx.restore();
    } else {
        tctx.drawImage(base, -s.x, -s.y);
        baseCtx.fillStyle = '#ffffff';
        baseCtx.fillRect(s.x, s.y, s.w, s.h);
    }

    state.moveBuffer = tmp;
    state.moveOffset = { dx: pos.x - s.x, dy: pos.y - s.y };
    state.movingSelection = true;
};

const moveSelectionPreview = (pos) => {
    clearOverlay();
    const nx = pos.x - state.moveOffset.dx;
    const ny = pos.y - state.moveOffset.dy;
    overlayCtx.drawImage(state.moveBuffer, nx, ny);
    if (state.selection.path) drawDashedPath(state.selection.path, nx, ny, true);
    else drawDashedRect(nx, ny, state.selection.w, state.selection.h);
    state._pendingMove = { x: nx, y: ny };
};

const commitMoveSelection = () => {
    const { x, y } = state._pendingMove || { x: state.selection.x, y: state.selection.y };
    baseCtx.drawImage(state.moveBuffer, x, y);
    state.selection = { ...state.selection, x, y };
    state.movingSelection = false;
    state.moveBuffer = null;
    clearOverlay();
    if (state.selection.path) drawDashedPath(state.selection.path, x, y, true);
    else drawDashedRect(x, y, state.selection.w, state.selection.h);
};

const finalizeMarquee = (pos) => {
    const x = Math.min(state.startPos.x, pos.x);
    const y = Math.min(state.startPos.y, pos.y);
    const w = Math.abs(pos.x - state.startPos.x);
    const h = Math.abs(pos.y - state.startPos.y);
    if (w > 2 && h > 2) {
        state.selection = { x, y, w, h };
        drawDashedRect(x, y, w, h);
    } else {
        state.selection = null;
        clearOverlay();
    }
};

const finalizeLasso = () => {
    if (!lassoPoints || lassoPoints.length < 3) { lassoPoints = null; clearOverlay(); return; }
    const xs = lassoPoints.map((p) => p.x), ys = lassoPoints.map((p) => p.y);
    const minX = Math.max(0, Math.min(...xs)), minY = Math.max(0, Math.min(...ys));
    const maxX = Math.min(base.width, Math.max(...xs)), maxY = Math.min(base.height, Math.max(...ys));
    const w = Math.ceil(maxX - minX), h = Math.ceil(maxY - minY);
    if (w < 2 || h < 2) { lassoPoints = null; clearOverlay(); return; }
    const path = lassoPoints.map((p) => ({ x: p.x - minX, y: p.y - minY }));
    state.selection = { x: minX, y: minY, w, h, path };
    drawDashedPath(path, minX, minY, true);
    lassoPoints = null;
};

const clearSelectionArea = () => {
    if (!state.selection) return;
    pushHistory();
    const s = state.selection;
    if (s.path) {
        baseCtx.save();
        baseCtx.beginPath();
        baseCtx.moveTo(s.x + s.path[0].x, s.y + s.path[0].y);
        for (let i = 1; i < s.path.length; i++) baseCtx.lineTo(s.x + s.path[i].x, s.y + s.path[i].y);
        baseCtx.closePath();
        baseCtx.clip();
        baseCtx.fillStyle = '#ffffff';
        baseCtx.fillRect(s.x, s.y, s.w, s.h);
        baseCtx.restore();
    } else {
        baseCtx.fillStyle = '#ffffff';
        baseCtx.fillRect(s.x, s.y, s.w, s.h);
    }
};

const selectAll = () => {
    state.selection = { x: 0, y: 0, w: base.width, h: base.height };
    clearOverlay();
    drawDashedRect(0, 0, base.width, base.height);
    setStatus('Select All.');
};

// ---------------- text tool ----------------

let activeTextInput = null;

const openTextInput = (e, pos) => {
    if (activeTextInput) return;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'paint-text-input';
    input.style.position = 'fixed';
    input.style.left = `${e.clientX}px`;
    input.style.top = `${e.clientY - 10}px`;
    input.style.font = `${Math.max(12, state.size * 4)}px 'Space Mono', monospace`;
    input.style.color = state.primary;
    input.style.background = 'rgba(255,255,255,0.85)';
    input.style.border = '1px dashed #000';
    input.style.zIndex = 100000;
    input.style.padding = '1px 2px';
    document.body.appendChild(input);
    activeTextInput = input;
    input.focus();

    const commit = () => {
        const value = input.value;
        if (value && value.trim()) {
            pushHistory();
            baseCtx.font = `${Math.max(12, state.size * 4)}px 'Space Mono', monospace`;
            baseCtx.fillStyle = state.primary;
            baseCtx.textBaseline = 'top';
            baseCtx.fillText(value, pos.x, pos.y);
        }
        input.remove();
        activeTextInput = null;
    };

    input.addEventListener('keydown', (ke) => {
        if (ke.key === 'Enter') { ke.preventDefault(); commit(); }
        if (ke.key === 'Escape') { ke.preventDefault(); input.remove(); activeTextInput = null; }
    });
    input.addEventListener('blur', commit);
};

// ---------------- pointer event routing ----------------

const onPointerDown = (e) => {
    overlay.setPointerCapture(e.pointerId);
    const pos = getCanvasPos(e);
    state.isPointerDown = true;
    state.button = e.button;
    state.startPos = pos;
    state.lastPos = pos;

    if (state.tool === 'curve') { handleCurveDown(pos); updateCoords(pos); return; }
    if (state.tool === 'polygon') { handlePolygonDown(pos); updateCoords(pos); return; }

    switch (state.tool) {
        case 'pencil': case 'brush': case 'airbrush': case 'eraser':
            pushHistory();
            paintStroke(pos, true);
            break;
        case 'fill':
            pushHistory();
            floodFill(pos.x, pos.y, e.button === 2 ? state.secondary : state.primary);
            break;
        case 'eyedropper':
            pickColor(pos, e.button);
            break;
        case 'zoom':
            cycleZoom();
            break;
        case 'line': case 'rect': case 'roundrect': case 'ellipse':
            pushHistory();
            break;
        case 'select':
            if (state.selection && !state.selection.path && isInsideSelectionBox(pos)) {
                pushHistory();
                startMoveSelection(pos);
            } else {
                state.selection = null;
                clearOverlay();
            }
            break;
        case 'lasso':
            if (state.selection && state.selection.path && isInsideSelectionBox(pos)) {
                pushHistory();
                startMoveSelection(pos);
            } else {
                state.selection = null;
                lassoPoints = [pos];
                clearOverlay();
            }
            break;
        case 'text':
            openTextInput(e, pos);
            break;
    }
    updateCoords(pos);
};

const onPointerMove = (e) => {
    const pos = getCanvasPos(e);
    updateCoords(pos);

    if (state.tool === 'curve') { handleCurveMove(pos); return; }
    if (state.tool === 'polygon') { if (polygonState) handlePolygonMove(pos); return; }

    if (!state.isPointerDown) return;

    switch (state.tool) {
        case 'pencil': case 'brush': case 'airbrush': case 'eraser':
            paintStroke(pos, false);
            state.lastPos = pos;
            break;
        case 'line': case 'rect': case 'roundrect': case 'ellipse':
            previewShape(pos);
            break;
        case 'select':
            if (state.movingSelection) moveSelectionPreview(pos);
            else {
                clearOverlay();
                const x = Math.min(state.startPos.x, pos.x);
                const y = Math.min(state.startPos.y, pos.y);
                drawDashedRect(x, y, Math.abs(pos.x - state.startPos.x), Math.abs(pos.y - state.startPos.y));
            }
            break;
        case 'lasso':
            if (state.movingSelection) moveSelectionPreview(pos);
            else if (lassoPoints) {
                lassoPoints.push(pos);
                clearOverlay();
                drawDashedPath(lassoPoints);
            }
            break;
    }
};

const onPointerUp = (e) => {
    if (!state.isPointerDown) { state.isPointerDown = false; return; }
    const pos = getCanvasPos(e);

    switch (state.tool) {
        case 'line': case 'rect': case 'roundrect': case 'ellipse':
            commitShape(pos);
            break;
        case 'select':
            if (state.movingSelection) commitMoveSelection();
            else finalizeMarquee(pos);
            break;
        case 'lasso':
            if (state.movingSelection) commitMoveSelection();
            else finalizeLasso();
            break;
    }
    state.isPointerDown = false;
};

// ---------------- menu bar (File / Edit / View / Image / Options / Help) ----------------

const setupMenus = () => {
    const paintWin = document.getElementById('paint');
    const menuItems = paintWin.querySelectorAll('.menubar > li');
    menuItems.forEach((item) => {
        item.addEventListener('click', (e) => {
            const dropdown = item.querySelector('.context-menu');
            if (!dropdown) return;
            const isVisible = dropdown.style.display === 'block';
            paintWin.querySelectorAll('.context-menu').forEach((d) => { d.style.display = 'none'; });
            paintWin.querySelectorAll('.menubar > li').forEach((li) => li.classList.remove('active'));
            if (!isVisible) { dropdown.style.display = 'block'; item.classList.add('active'); }
            e.stopPropagation();
        });
    });
    document.addEventListener('click', () => {
        paintWin.querySelectorAll('.context-menu').forEach((d) => { d.style.display = 'none'; });
        paintWin.querySelectorAll('.menubar > li').forEach((li) => li.classList.remove('active'));
    });
};

const clearImage = () => {
    pushHistory();
    baseCtx.fillStyle = '#ffffff';
    baseCtx.fillRect(0, 0, base.width, base.height);
    state.selection = null;
    clearOverlay();
    setStatus('New image.');
};

const savePNG = () => {
    const dataUrl = base.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `uluc-paint-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
    addToGallery(dataUrl);
    setStatus('Saved as PNG and added to My Pictures.');
};

const openFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (re) => loadImageIntoCanvas(re.target.result);
        reader.readAsDataURL(file);
    };
    input.click();
};

const invertColors = () => {
    pushHistory();
    const imgData = baseCtx.getImageData(0, 0, base.width, base.height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; }
    baseCtx.putImageData(imgData, 0, 0);
    setStatus('Inverted colors.');
};

const flip = (horizontal) => {
    pushHistory();
    const w = base.width, h = base.height;
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    tmp.getContext('2d').drawImage(base, 0, 0);
    baseCtx.save();
    baseCtx.clearRect(0, 0, w, h);
    if (horizontal) { baseCtx.translate(w, 0); baseCtx.scale(-1, 1); } else { baseCtx.translate(0, h); baseCtx.scale(1, -1); }
    baseCtx.drawImage(tmp, 0, 0);
    baseCtx.restore();
    setStatus(horizontal ? 'Flipped horizontal.' : 'Flipped vertical.');
};

const bindMenuActions = () => {
    document.getElementById('paint-menu-new').onclick = clearImage;
    document.getElementById('paint-menu-open-file').onclick = openFile;
    document.getElementById('paint-menu-save').onclick = savePNG;
    document.getElementById('paint-menu-open-gallery').onclick = () => openWindow('my-pictures');
    document.getElementById('paint-menu-exit').onclick = () => closeWindow(document.getElementById('paint'));
    document.getElementById('paint-menu-undo').onclick = undo;
    document.getElementById('paint-menu-redo').onclick = redo;
    document.getElementById('paint-menu-select-all').onclick = selectAll;
    document.getElementById('paint-menu-clear-selection').onclick = clearSelectionArea;
    document.getElementById('paint-menu-zoom-in').onclick = zoomIn;
    document.getElementById('paint-menu-zoom-out').onclick = zoomOut;
    document.getElementById('paint-menu-zoom-reset').onclick = zoomReset;
    document.getElementById('paint-menu-flip-h').onclick = () => flip(true);
    document.getElementById('paint-menu-flip-v').onclick = () => flip(false);
    document.getElementById('paint-menu-invert').onclick = invertColors;
    document.getElementById('paint-menu-clear-image').onclick = clearImage;
    document.getElementById('paint-menu-edit-colors').onclick = () => openColorPicker('primary');
    document.getElementById('paint-menu-about').onclick = () => alert('Paint\nA tiny MS Paint clone built for Uluç\'s portfolio.\n(Not affiliated with Microsoft.)');
};

// ---------------- color picker dialog (native input[type=color]) ----------------

const openColorPicker = (which) => {
    colorPickerEl.value = which === 'primary' ? state.primary : state.secondary;
    colorPickerEl.onchange = () => { if (which === 'primary') setPrimary(colorPickerEl.value); else setSecondary(colorPickerEl.value); };
    colorPickerEl.click();
};

// ---------------- toolbox ----------------

const renderToolOptions = () => {
    if (!optionsEl) return;
    optionsEl.innerHTML = '';
    optionsEl.style.display = 'flex';
    
    if (['brush', 'eraser', 'airbrush', 'line', 'curve'].includes(state.tool)) {
        const sizes = [2, 4, 8];
        const isBrush = state.tool === 'brush';
        sizes.forEach(sz => {
            const btn = document.createElement('div');
            btn.style.width = '100%';
            btn.style.height = '18px';
            btn.style.display = 'flex';
            btn.style.alignItems = 'center';
            btn.style.justifyContent = 'center';
            btn.style.cursor = 'pointer';
            btn.style.background = state.size === sz && (!isBrush || state.shape === 'round') ? '#000080' : 'transparent';
            btn.style.color = state.size === sz && (!isBrush || state.shape === 'round') ? '#fff' : '#000';
            
            const indicator = document.createElement('div');
            indicator.style.background = btn.style.color;
            if (state.tool === 'line' || state.tool === 'curve') {
                indicator.style.width = '30px';
                indicator.style.height = `${sz}px`;
            } else {
                indicator.style.width = `${sz*2}px`;
                indicator.style.height = `${sz*2}px`;
                indicator.style.borderRadius = '50%';
            }
            btn.appendChild(indicator);
            
            btn.onclick = () => {
                state.size = sz;
                state.shape = 'round';
                renderToolOptions();
            };
            optionsEl.appendChild(btn);
        });
        
        if (isBrush) {
            // Add square shapes
            sizes.forEach(sz => {
                const btn = document.createElement('div');
                btn.style.width = '100%';
                btn.style.height = '18px';
                btn.style.display = 'flex';
                btn.style.alignItems = 'center';
                btn.style.justifyContent = 'center';
                btn.style.cursor = 'pointer';
                btn.style.background = state.size === sz && state.shape === 'square' ? '#000080' : 'transparent';
                
                const indicator = document.createElement('div');
                indicator.style.background = state.size === sz && state.shape === 'square' ? '#fff' : '#000';
                indicator.style.width = `${sz*2}px`;
                indicator.style.height = `${sz*2}px`;
                btn.appendChild(indicator);
                
                btn.onclick = () => {
                    state.size = sz;
                    state.shape = 'square';
                    renderToolOptions();
                };
                optionsEl.appendChild(btn);
            });
            // Make optionsEl scrollable if too many
            optionsEl.style.overflowY = 'auto';
            optionsEl.style.justifyContent = 'flex-start';
        } else {
            optionsEl.style.overflowY = 'hidden';
            optionsEl.style.justifyContent = 'center';
        }
    } else {
        optionsEl.style.display = 'none';
    }
};

const setupToolbox = () => {
    document.querySelectorAll('.paint-tool').forEach((btn) => {
        btn.addEventListener('mouseenter', () => setStatus(TOOL_LABELS[btn.dataset.tool] || btn.dataset.tool));
        btn.addEventListener('mouseleave', () => setStatus('For Help, click a tool.'));
        btn.addEventListener('click', () => {
            if (btn.dataset.tool === 'zoom') { cycleZoom(); return; }

            document.querySelectorAll('.paint-tool').forEach((b) => b.classList.remove('selected'));
            btn.classList.add('selected');
            state.tool = btn.dataset.tool;

            if (state.tool !== 'select' && state.tool !== 'lasso') { state.selection = null; clearOverlay(); }
            if (curveState) { curveState = null; clearOverlay(); }
            if (polygonState) { polygonState = null; clearOverlay(); }

            overlay.style.cursor = state.tool === 'text' ? 'text' : 'crosshair';
            setStatus(`${TOOL_LABELS[state.tool]} selected.`);
            
            renderToolOptions();
        });
    });
    renderToolOptions();
};

// ---------------- keyboard shortcuts (only while Paint is the active window) ----------------

const setupKeyboardShortcuts = () => {
    document.addEventListener('keydown', (e) => {
        const paintWin = document.getElementById('paint');
        if (!paintWin || !paintWin.classList.contains('active') || paintWin.style.display === 'none') return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
        else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); redo(); }
        else if ((e.key === 'Delete' || e.key === 'Backspace') && (state.tool === 'select' || state.tool === 'lasso') && state.selection) { e.preventDefault(); clearSelectionArea(); }
        else if (e.key === 'Enter' && state.tool === 'polygon' && polygonState) { e.preventDefault(); finalizePolygon(); }
        else if (e.key === 'Escape') {
            state.selection = null; lassoPoints = null; curveState = null; polygonState = null; clearOverlay();
        }
    });

    document.addEventListener('paste', (e) => {
        const paintWin = document.getElementById('paint');
        if (!paintWin || !paintWin.classList.contains('active') || paintWin.style.display === 'none') return;

        if (e.clipboardData && e.clipboardData.items) {
            for (let item of e.clipboardData.items) {
                if (item.type.indexOf('image/') !== -1) {
                    const blob = item.getAsFile();
                    if (!blob) continue;
                    const reader = new FileReader();
                    reader.onload = (event) => loadImageIntoCanvas(event.target.result);
                    reader.readAsDataURL(blob);
                    e.preventDefault();
                    break;
                }
            }
        }
    });
};

// ---------------- init ----------------

const setupCanvasResize = () => {
    const container = document.getElementById('paint-canvas-container');
    const handles = [
        { el: document.getElementById('paint-resize-x'), dir: 'x' },
        { el: document.getElementById('paint-resize-y'), dir: 'y' },
        { el: document.getElementById('paint-resize-xy'), dir: 'xy' }
    ];

    handles.forEach(({ el, dir }) => {
        if (!el) return;
        el.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            el.setPointerCapture(e.pointerId);

            const startW = base.width;
            const startH = base.height;
            const startX = e.clientX;
            const startY = e.clientY;
            
            const onMove = (me) => {
                let newW = startW;
                let newH = startH;
                if (dir.includes('x')) newW = Math.max(10, Math.round((startW + (me.clientX - startX)) / state.zoomLevel));
                if (dir.includes('y')) newH = Math.max(10, Math.round((startH + (me.clientY - startY)) / state.zoomLevel));
                
                container.style.width = `${newW * state.zoomLevel}px`;
                container.style.height = `${newH * state.zoomLevel}px`;
            };
            
            const onUp = (ue) => {
                el.releasePointerCapture(e.pointerId);
                el.removeEventListener('pointermove', onMove);
                el.removeEventListener('pointerup', onUp);
                el.removeEventListener('pointercancel', onUp);
                
                let newW = startW;
                let newH = startH;
                if (dir.includes('x')) newW = Math.max(10, Math.round((startW + (ue.clientX - startX)) / state.zoomLevel));
                if (dir.includes('y')) newH = Math.max(10, Math.round((startH + (ue.clientY - startY)) / state.zoomLevel));
                
                if (newW !== startW || newH !== startH) {
                    pushHistory();
                    const imgData = baseCtx.getImageData(0, 0, startW, startH);
                    
                    base.width = newW;
                    base.height = newH;
                    overlay.width = newW;
                    overlay.height = newH;
                    
                    baseCtx.fillStyle = '#ffffff';
                    baseCtx.fillRect(0, 0, newW, newH);
                    baseCtx.putImageData(imgData, 0, 0);
                    
                    applyZoom();
                    setStatus(`Resized to ${newW} x ${newH}`);
                }
            };
            
            el.addEventListener('pointermove', onMove);
            el.addEventListener('pointerup', onUp);
            el.addEventListener('pointercancel', onUp);
        });
    });
};

const init = () => {
    base = document.getElementById('paint-canvas');
    overlay = document.getElementById('paint-overlay');
    if (!base || !overlay) return;

    baseCtx = base.getContext('2d', { willReadFrequently: true });
    overlayCtx = overlay.getContext('2d');
    canvasWrap = document.getElementById('paint-canvas-wrap');
    optionsEl = document.getElementById('paint-tool-options');
    statusEl = document.getElementById('paint-status');
    coordsEl = document.getElementById('paint-coords');
    zoomFieldEl = document.getElementById('paint-zoom-field');
    primarySwatchEl = document.getElementById('paint-primary-swatch');
    secondarySwatchEl = document.getElementById('paint-secondary-swatch');
    colorPickerEl = document.getElementById('paint-color-picker');

    baseCtx.fillStyle = '#ffffff';
    baseCtx.fillRect(0, 0, base.width, base.height);
    pushHistory();

    buildPalette();
    setupToolbox();
    setupMenus();
    bindMenuActions();
    setupKeyboardShortcuts();
    watchGalleryWindowVisibility();
    setupCanvasResize();

    overlay.addEventListener('pointerdown', onPointerDown);
    overlay.addEventListener('pointermove', onPointerMove);
    overlay.addEventListener('pointerup', onPointerUp);
    overlay.addEventListener('pointercancel', onPointerUp);
    overlay.addEventListener('contextmenu', (e) => e.preventDefault());
    overlay.addEventListener('dblclick', () => { if (state.tool === 'polygon') finalizePolygon(); });

    
    document.getElementById('paint-color-indicator').addEventListener('dblclick', () => openColorPicker('primary'));
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
