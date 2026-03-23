// projectmanager.js
// Bu dosya, projelerin yüklenmesini, tabloda ve klasörde gösterilmesini yönetir.

// Gerekli fonksiyonları windowmanager.js dosyasından import ediyoruz
import { openWindow, bringToFront } from './windows.js';

let projectsData = [];

// --- Proje Verilerini Yükleme ---
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
        document.getElementById('portfolio-projects-body').innerHTML = '<tr><td colspan="3">Projeler yüklenirken bir hata oluştu.</td></tr>';
        document.getElementById('project-grid').innerHTML = '<p>Projeler yüklenirken bir hata oluştu.</p>';
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
            // Close the start menu
            const startMenu = document.getElementById('start-menu');
            if (startMenu) startMenu.style.display = 'none';
        });
        submenu.appendChild(li);
    });
};

// Proje tablosunu doldurur
const populateProjectsTable = () => {
    const tbody = document.getElementById('portfolio-projects-body');
    const openBtn = document.getElementById('open-project-btn');
    let selectedProject = null;

    const eventType = window.innerWidth <= 768 ? 'click' : 'dblclick';

    tbody.innerHTML = '';
    document.getElementById('project-count-table').textContent = projectsData.length;

    projectsData.forEach(proj => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${proj.title}</td><td>${proj.type}</td><td>${proj.date}</td>`;
        tr.style.cursor = 'pointer';

        tr.addEventListener('click', () => {
            const prev = tbody.querySelector('tr.highlighted');
            if (prev) {
                prev.classList.remove('highlighted');
            }

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

// Proje klasörünü doldurur
const populateProjectsFolder = () => {
    const grid = document.getElementById('project-grid');
    grid.innerHTML = '';
    document.getElementById('project-count-folder').textContent = projectsData.length;

    const eventType = window.innerWidth <= 768 ? 'click' : 'dblclick';

    projectsData.forEach(project => {
        const shortcut = document.createElement('div');
        shortcut.className = 'project-shortcut';
        shortcut.style.position = 'relative'; // Ensure positioning context
        shortcut.innerHTML = `
            <div style="position: relative; width: 150px; height: 150px;">
                <img src="${project.thumbnail}" alt="${project.title}" style="width: 100%; height: 100%; object-fit: cover;" />
                <img src="assets/icons/w2k_shortcut_overlay.png" style="position: absolute; left: 0; bottom: 0; width: 16px; height: 16px; pointer-events: none;" />
            </div>
            <div>${project.title}</div>
        `;
        shortcut.addEventListener(eventType, () => showProjectDetail(project));
        grid.appendChild(shortcut);
    });
};

// Proje detay penceresini gösterir
export const showProjectDetail = (project) => {
    const windowId = `project-detail-${project.id}`;
    let detailWin = document.getElementById(windowId);

    // Eğer pencere zaten varsa, sadece öne getir
    if (detailWin) {
        if (detailWin.style.display === 'none') {
            openWindow(windowId);
        } else {
            bringToFront(detailWin);
        }
        return;
    }

    // Yeni pencere elementi oluştur
    detailWin = document.createElement('div');
    detailWin.className = 'window';
    detailWin.id = windowId;
    detailWin.style.width = '880px';
    detailWin.style.display = 'none'; // openWindow handles showing it

    // Medya HTML'ini oluştur
    const mediaHtml = (project.media || []).map(src => {
        const lowerSrc = src.toLowerCase();
        const isVideo = lowerSrc.endsWith('.mp4') || lowerSrc.endsWith('.mov') || lowerSrc.endsWith('.webm');
        const isAudio = lowerSrc.endsWith('.mp3') || lowerSrc.endsWith('.wav') || lowerSrc.endsWith('.ogg');
        const mediaTitle = src.split('/').pop();
        const classes = "project-media-item";

        if (isVideo) {
            return `
                <div class="${classes}" data-src="${src}" data-title="${mediaTitle}" style="margin-bottom: 10px; cursor: pointer;">
                    <div style="position: relative;">
                        <video src="${src}#t=0.5" style="max-width: 100%; height: auto; border: 1px solid grey; background: #000;" preload="metadata"></video>
                        <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.1);">
                            <img src="assets/icons/w2k_mplayer32_1.png" style="width: 24px; height: 24px; opacity: 0.8;" />
                        </div>
                    </div>
                    <div style="text-align: center; font-size: 9px; color: #555; margin-top: 4px;">${mediaTitle}</div>
                </div>
            `;
        } else if (isAudio) {
            return `
                <div class="${classes}" data-src="${src}" data-title="${mediaTitle}" style="margin-bottom: 12px;">
                    <div class="sunken-panel" style="background: silver; padding: 4px; border: 1px solid #808080;">
                        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px; padding: 2px;">
                            <img src="assets/icons/w2k_audio_cd.png" style="width: 16px; height: 16px;">
                            <span style="font-size: 10px; color: black; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${mediaTitle}</span>
                        </div>
                        <audio src="${src}" controls style="width: 100%; height: 32px; filter: grayscale(1) contrast(1.2) brightness(1.2);"></audio>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="${classes}" data-src="${src}" data-title="${mediaTitle}" style="margin-bottom: 10px; cursor: pointer;">
                    <img src="${src}" alt="${mediaTitle}" style="max-width: 100%; height: auto; border: 1px solid grey;" />
                    <div style="text-align: center; font-size: 9px; color: #555; margin-top: 4px;">${mediaTitle}</div>
                </div>
            `;
        }
    }).join('');

    detailWin.innerHTML = `
        <div class="title-bar">
            <div class="title-bar-text">
                <img src="assets/icons/w2k_unknown_14.png" style="width: 16px; height: 16px; margin-right: 4px; vertical-align: middle;">
                ${project.title}
            </div>
            <div class="title-bar-controls">
                <button class="minimize-btn" aria-label="Minimize"></button>
                <button class="close-btn" aria-label="Close"></button>
            </div>
        </div>
        <div class="window-body">
            <div style="display: flex; flex-direction: column; gap: 12px;">
                <!-- Header Section -->
                <div style="display: flex; gap: 15px; align-items: flex-start;">
                    <div class="sunken-panel" style="padding: 2px; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; background: #000;">
                        <img src="${project.thumbnail}" alt="${project.title} Thumbnail" style="max-width: 100%; max-height: 100%; object-fit: contain;">
                    </div>
                    <div style="flex-grow: 1;">
                        <h2 style="margin: 0 0 5px 0; font-size: 1.4rem; display: flex; align-items: center; gap: 10px; color: navy;">
                            <img src="assets/icons/w2k_unknown_14.png" style="width: 20px; height: 20px;"> 
                            ${project.title}
                        </h2>
                        <div style="display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; font-size: 11px;">
                            <strong>Type:</strong> <span>${project.type}</span>
                            <strong>Date:</strong> <span>${project.date}</span>
                            <strong>Role:</strong> <span>${project.role || '-'}</span>
                        </div>
                    </div>
                </div>

                <!-- Main Workspace Section -->
                <div style="display: flex; gap: 10px; height: 480px;">
                    <!-- Notepad Editor (Left) -->
                    <div class="sunken-panel" style="flex: 2; background: white; display: flex; flex-direction: column; min-width: 0;">
                        <ul class="menubar" style="border-bottom: 1px solid #808080; padding: 0 4px; display: flex; list-style: none; margin: 0; gap: 0; box-shadow: inset 1px 1px #fff;">
                            <li style="padding: 1px 6px; font-size: 11px;"><span style="text-decoration: underline;">F</span>ile</li>
                            <li style="padding: 1px 6px; font-size: 11px;"><span style="text-decoration: underline;">E</span>dit</li>
                            <li style="padding: 1px 6px; font-size: 11px;"><span style="text-decoration: underline;">S</span>earch</li>
                            <li style="padding: 1px 6px; font-size: 11px;"><span style="text-decoration: underline;">H</span>elp</li>
                        </ul>
                        <div style="padding: 15px; overflow-y: auto; flex-grow: 1; font-family: 'Courier New', Courier, monospace; color: black; line-height: 1.2; font-size: 13px;">
                            ${marked.parse(project.description || '-')}
                        </div>
                        <div style="background: #c0c0c0; border-top: 1px solid #808080; padding: 2px 8px; display: flex; justify-content: flex-end; font-size: 10px; color: black; box-shadow: inset 1px 1px #fff;">
                            UTF-8 | Ln 1, Col 1
                        </div>
                    </div>

                    <!-- Media Gallery (Right) -->
                    <div class="sunken-panel" style="flex: 1; min-width: 220px; background: #dfdfdf; display: flex; flex-direction: column;">
                        <div style="background: navy; color: white; padding: 2px 8px; font-size: 11px; font-weight: bold; display: flex; align-items: center; justify-content: space-between;">
                            <span>Preview Explorer</span>
                            <span style="font-size: 10px; opacity: 0.8;">${(project.media || []).length} items</span>
                        </div>
                        <div class="project-media-container" style="padding: 10px; overflow-y: auto; flex-grow: 1; display: flex; flex-direction: column; gap: 12px;">
                            ${mediaHtml || '<div style="color: #666; font-size: 11px; text-align: center; margin-top: 20px;">No media found.</div>'}
                        </div>
                    </div>
                </div>
                
                <!-- Status Bar / Footer -->
                <div class="status-bar" style="margin-top: -5px;">
                    <p class="status-bar-field" style="flex: 2;">Tags: ${(project.tags || []).join(', ')}</p>
                    <p class="status-bar-field" style="flex: 1;">Project ID: ${project.id}</p>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(detailWin);

    // Event listeners for the new window
    const closeBtn = detailWin.querySelector('.close-btn');
    if (closeBtn) {
        closeBtn.onclick = () => detailWin.remove();
    }

    const minimizeBtn = detailWin.querySelector('.minimize-btn');
    if (minimizeBtn) {
        minimizeBtn.onclick = () => {
            detailWin.style.display = 'none';
            detailWin.classList.remove('active');
            // updateWindowData is internal to windows.js, but openWindow handles taskbar.
            // Since we're creating this dynamically, let's hope windows.js handles it.
        };
    }

    // Media click listeners for the new window
    const mediaContainer = detailWin.querySelector('.project-media-container');
    mediaContainer.addEventListener('click', (e) => {
        if (e.target.tagName === 'AUDIO') return;
        const mediaItem = e.target.closest('.project-media-item');
        if (mediaItem) {
            const src = mediaItem.getAttribute('data-src');
            const title = mediaItem.getAttribute('data-title');
            if (src) {
                openMediaWindow(src, title);
            }
        }
    });

    // Pencereyi açma işlemini openWindow fonksiyonuna bırakıyoruz
    openWindow(windowId);

    // Dynamic windows need to be made draggable if they weren't in the initial batch
    // We should probably export a way to make a single window draggable or re-run the universal one.
    import('./windows.js').then(mod => {
        if (mod.bringToFront) mod.bringToFront(detailWin);
        // Re-run draggable setup for the new window
        // Note: this is a bit hacky as windows.js doesn't export a single-window version yet.
        mod.makeAllWindowsDraggable();
    });
};

// Medya dosyalarını yeni bir pencerede açar
const openMediaWindow = (src, title) => {
    const lowerSrc = src.toLowerCase();
    const isVideo = lowerSrc.endsWith('.mp4') || lowerSrc.endsWith('.mov') || lowerSrc.endsWith('.webm');
    const isAudio = lowerSrc.endsWith('.mp3') || lowerSrc.endsWith('.wav') || lowerSrc.endsWith('.ogg');
    
    // Create the window element
    const mediaWin = document.createElement('div');
    mediaWin.className = 'window';
    mediaWin.style.position = 'absolute';
    mediaWin.style.width = 'auto';
    mediaWin.style.height = 'auto';
    mediaWin.style.maxWidth = '90vw';
    mediaWin.style.maxHeight = '90vh';
    mediaWin.style.zIndex = '100';

    let mediaContent = '';
    if (isVideo) {
        mediaContent = `<video src="${src}" controls style="display: block; max-width: 100%; max-height: 80vh;" autoplay></video>`;
    } else if (isAudio) {
        mediaContent = `
            <div style="padding: 30px; background: silver; display: flex; flex-direction: column; align-items: center; gap: 20px; width: 400px;">
                <img src="assets/icons/w2k_audio_cd.png" style="width: 64px; height: 64px;" />
                <audio src="${src}" controls style="width: 100%;" autoplay></audio>
                <div style="font-size: 11px; color: black; font-weight: bold; text-align: center;">${decodeURIComponent(title)}</div>
            </div>`;
    } else {
        mediaContent = `<img src="${src}" alt="${title}" style="display: block; max-width: 100%; max-height: 80vh;" />`;
    }

    mediaWin.innerHTML = `
    <div class="title-bar">
        <div class="title-bar-text">${decodeURIComponent(title)}</div>
        <div class="title-bar-controls">
            <button class="close-btn" aria-label="Close"></button>
        </div>
    </div>
    <div class="window-body" style="padding: 10px; overflow: auto; background: #000; display: flex; justify-content: center;">
        ${mediaContent}
    </div>
    `;

    document.body.appendChild(mediaWin);

    // Initial positioning (roughly centered)
    const setPosition = () => {
        const winWidth = mediaWin.offsetWidth;
        const winHeight = mediaWin.offsetHeight;
        mediaWin.style.left = `${(window.innerWidth - winWidth) / 2}px`;
        mediaWin.style.top = `${(window.innerHeight - winHeight) / 2}px`;
    };

    // Recalculate position after media loads to ensure "fit to content" works
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
    
    // Fallback if load event is missed or cached
    setTimeout(setPosition, 100);

    // Yeni pencereyi öne getir
    bringToFront(mediaWin);

    // Kapatma butonu olay dinleyicisi
    mediaWin.querySelector('.close-btn').addEventListener('click', () => {
        mediaWin.remove();
    });

    // Pencereyi sürüklenebilir hale getir
    const titleBar = mediaWin.querySelector('.title-bar');
    let isDragging = false;
    let offsetX, offsetY;

    titleBar.addEventListener('mousedown', (e) => {
        isDragging = true;
        offsetX = e.clientX - mediaWin.offsetLeft;
        offsetY = e.clientY - mediaWin.offsetTop;
        bringToFront(mediaWin);
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        let newLeft = e.clientX - offsetX;
        let newTop = e.clientY - offsetY;

        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const winWidth = mediaWin.offsetWidth;
        const winHeight = mediaWin.offsetHeight;

        if (newLeft < 0) newLeft = 0;
        if (newTop < 0) newTop = 0;
        if (newLeft + winWidth > screenWidth) newLeft = screenWidth - winWidth;
        if (newTop + winHeight > screenHeight) newTop = screenHeight - winHeight;

        mediaWin.style.left = `${newLeft}px`;
        mediaWin.style.top = `${newTop}px`;
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
};

// Make showProjectDetail globally available
window.showProjectDetail = showProjectDetail;

// Sayfa yüklendiğinde projeleri başlat
document.addEventListener('DOMContentLoaded', loadProjects);