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
    } catch (error) {
        console.error('Error loading projects:', error);
        document.getElementById('portfolio-projects-body').innerHTML = '<tr><td colspan="3">Projeler yüklenirken bir hata oluştu.</td></tr>';
        document.getElementById('project-grid').innerHTML = '<p>Projeler yüklenirken bir hata oluştu.</p>';
    }
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
        shortcut.innerHTML = `
            <img src="${project.thumbnail}" alt="${project.title}" />
            <div>${project.title}</div>
        `;
        shortcut.addEventListener(eventType, () => showProjectDetail(project));
        grid.appendChild(shortcut);
    });
};

// Proje detay penceresini gösterir
export const showProjectDetail = (project) => {
    const detailWin = document.getElementById('project-detail');
    const contentElem = document.getElementById('project-content');

    // Pencereyi açmadan önce içeriği hazırla
    document.getElementById('project-title').textContent = project.title;

    // Medya HTML'ini oluştur
    const mediaHtml = (project.media || []).map(src => {
        const isVideo = src.endsWith('.mp4') || src.endsWith('.mov') || src.endsWith('.webm');
        const mediaTitle = src.split('/').pop();
        const classes = "project-media-item";

        if (isVideo) {
            return `
                <div class="${classes}" data-src="${src}" data-title="${mediaTitle}">
                    <video src="${src}" style="max-width: 100%; height: auto; border: 1px solid grey;" muted autoplay loop></video>
                    <div style="text-align: center; font-size: 10px; color: #555;">(Video)</div>
                </div>
            `;
        } else {
            return `
                <img src="${src}" alt="${mediaTitle}" class="${classes}" style="max-width: 150px; height: auto; border: 1px solid grey; cursor: pointer;" data-src="${src}" data-title="${mediaTitle}" />
            `;
        }
    }).join('');

    contentElem.innerHTML = `
        <h3>${project.title}</h3>
        <p><strong>Type:</strong> ${project.type}</p>
        <p><strong>Date:</strong> ${project.date}</p>
        <p><strong>Role:</strong> ${project.role || '-'}</p>
        <p>${marked.parse(project.description || '-')}</p>
        <p><strong>Tags:</strong> ${(project.tags || []).join(', ')}</p>
        <hr/>
        <div id="project-media-container" class="media-scroll-container" style="display: flex; flex-wrap: wrap; gap: 10px;">
            ${mediaHtml}
        </div>
    `;

    // Pencereyi açma işlemini openWindow fonksiyonuna bırakıyoruz
    openWindow('project-detail');

    const mediaContainer = document.getElementById('project-media-container');
    mediaContainer.addEventListener('click', (e) => {
        const mediaItem = e.target.closest('.project-media-item, img');
        if (mediaItem) {
            const src = mediaItem.getAttribute('data-src');
            const title = mediaItem.getAttribute('data-title');
            if (src) {
                openMediaWindow(src, title);
            }
        }
    });
};

// Medya dosyalarını yeni bir pencerede açar
const openMediaWindow = (src, title) => {
    const mediaWin = document.createElement('div');
    mediaWin.className = 'window';
    mediaWin.style.position = 'absolute';
    mediaWin.style.minWidth = '600px';
    mediaWin.style.maxWidth = '1280px';
    mediaWin.style.maxHeight = '720px';
    mediaWin.style.zIndex = '15';

    let mediaContent = '';
    const isVideo = src.endsWith('.mp4') || src.endsWith('.mov') || src.endsWith('.webm');
    if (isVideo) {
        mediaContent = `<video src="${src}" controls style="max-width: 80%; max-height: 80%;"></video>`;
    } else {
        mediaContent = `<img src="${src}" alt="${title}" style="max-width: 80%; max-height: 80%;" />`;
    }

    mediaWin.innerHTML = `
    <div class="title-bar">
        <div class="title-bar-text">${decodeURIComponent(title)}</div>
        <div class="title-bar-controls">
            <button class="close-btn" aria-label="Close"></button>
        </div>
    </div>
    <div class="window-body" style="padding: 10px; overflow: auto;">
        ${mediaContent}
    </div>
    `;

    document.body.appendChild(mediaWin);

    mediaWin.style.left = `10%`;
    mediaWin.style.top = `10%`;

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