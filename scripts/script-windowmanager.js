// windowmanager.js
// Bu dosya, tüm pencerelerin açılmasını, kapanmasını ve sürüklenmesini yönetir.

// --- Global Değişkenler ---
let highestZIndex = 20;

// Pencereyi en üste ve öne getirir
export const bringToFront = (win) => {
    document.querySelectorAll('.window.active').forEach(activeWin => {
        activeWin.classList.remove('active');
    });
    win.classList.add('active');
    win.style.zIndex = ++highestZIndex;
};

// Pencere açma fonksiyonu
export const openWindow = (id) => {
    const win = document.getElementById(id);
    if (!win) return;

    win.style.display = 'block';

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = win.offsetWidth;
    const height = win.offsetHeight;

    let newLeft = (vw - width) / 2;
    let newTop = (vh - height) / 2;

    if (newLeft < 0) newLeft = 0;
    if (newTop < 0) newTop = 0;

    win.style.left = `${newLeft}px`;
    win.style.top = `${newTop}px`;

    bringToFront(win);
};

// Pencere kapatma fonksiyonu
export const closeWindow = (win) => {
    win.style.display = 'none';
};

export const makeAllWindowsDraggable = () => {
    document.querySelectorAll('.window').forEach(win => {
        const titleBar = win.querySelector('.title-bar');
        if (!titleBar) return;

        let isDragging = false;
        let offsetX, offsetY;

        titleBar.addEventListener('mousedown', (e) => {
            isDragging = true;
            offsetX = e.clientX - win.offsetLeft;
            offsetY = e.clientY - win.offsetTop;
            bringToFront(win);
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            let newLeft = e.clientX - offsetX;
            let newTop = e.clientY - offsetY;

            const screenWidth = window.innerWidth;
            const screenHeight = window.innerHeight;
            const winWidth = win.offsetWidth;
            const winHeight = win.offsetHeight;

            if (newLeft < 0) newLeft = 0;
            if (newTop < 0) newTop = 0;
            if (newLeft + winWidth > screenWidth) newLeft = screenWidth - winWidth;
            if (newTop + winHeight > screenHeight) newTop = screenHeight - winHeight;

            win.style.left = `${newLeft}px`;
            win.style.top = `${newTop}px`;
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    });
};

// Masaüstü ikonlarına çift tıklama
const setupDesktopIcons = () => {
    document.querySelectorAll('.desktop-icon').forEach(icon => {
        icon.addEventListener('dblclick', () => {
            const windowId = icon.dataset.windowId;
            const externalLink = icon.dataset.externalLink;

            if (windowId) {
                openWindow(windowId);
            } else if (externalLink) {
                window.open(externalLink, '_blank');
            }
        });
    });
};

// Pencerelerdeki kapatma butonları
const setupCloseButtons = () => {
    document.querySelectorAll('.close-btn').forEach(btn => {
        const windowToClose = btn.closest('.window');
        if (windowToClose) {
            btn.addEventListener('click', () => closeWindow(windowToClose));
        }
    });
};

// Pencerelere tıklandığında öne getirme
const setupWindowFocus = () => {
    document.querySelectorAll('.window').forEach(win => {
        win.addEventListener('mousedown', () => bringToFront(win));
    });
};

document.addEventListener('DOMContentLoaded', () => {
    makeAllWindowsDraggable();
    setupDesktopIcons();
    setupCloseButtons();
    setupWindowFocus();
});