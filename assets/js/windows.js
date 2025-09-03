// windowmanager.js
// Bu dosya, tüm pencerelerin açılmasını, kapanmasını ve sürüklenmesini yönetir.

// --- Global Değişkenlar ---
let highestZIndex = 20;
const openWindows = new Map(); // Track open windows for taskbar

// Taskbar management functions
const updateTaskbar = () => {
    const taskbarWindows = document.querySelector('.taskbar-windows');
    if (!taskbarWindows) return;

    // Clear existing taskbar buttons
    taskbarWindows.innerHTML = '';

    // Add buttons for each open window
    openWindows.forEach((windowData, windowId) => {
        const button = document.createElement('button');
        button.className = 'taskbar-button';
        
        // Create button content with icon and text
        const iconHtml = windowData.icon ? `<img src="${windowData.icon}" style="width: 16px; height: 16px; margin-right: 4px; vertical-align: middle;">` : '';
        button.innerHTML = `${iconHtml}${windowData.title}`;
        button.dataset.windowId = windowId;
        
        // Add active state if window is active
        if (windowData.isActive) {
            button.classList.add('active');
        }
        
        // Click handler to bring window to front or minimize
        button.addEventListener('click', () => {
            const win = document.getElementById(windowId);
            if (win) {
                if (win.style.display === 'none' || !windowData.isActive) {
                    win.style.display = 'block';
                    bringToFront(win);
                } else {
                    // If window is already active, minimize it
                    win.style.display = 'none';
                    win.classList.remove('active');
                    updateWindowData(windowId, { isActive: false });
                }
            }
        });
        
        taskbarWindows.appendChild(button);
    });
};

const addToTaskbar = (windowId, title) => {
    // Extract icon from the window's title bar
    const win = document.getElementById(windowId);
    let icon = null;
    if (win) {
        const titleBarImg = win.querySelector('.title-bar-text img');
        if (titleBarImg) {
            icon = titleBarImg.src;
        }
    }
    
    openWindows.set(windowId, { title, isActive: true, icon });
    updateTaskbar();
};

const removeFromTaskbar = (windowId) => {
    openWindows.delete(windowId);
    updateTaskbar();
};

const updateWindowData = (windowId, updates) => {
    if (openWindows.has(windowId)) {
        const windowData = openWindows.get(windowId);
        openWindows.set(windowId, { ...windowData, ...updates });
        updateTaskbar();
    }
};

// Pencereyi en üste ve öne getirir
export const bringToFront = (win) => {
    // Remove active from all windows and taskbar buttons
    document.querySelectorAll('.window.active').forEach(activeWin => {
        activeWin.classList.remove('active');
        const winId = activeWin.id;
        if (openWindows.has(winId)) {
            updateWindowData(winId, { isActive: false });
        }
    });
    
    win.classList.add('active');
    win.style.zIndex = ++highestZIndex;
    
    // Update taskbar to show this window as active
    if (win.id && openWindows.has(win.id)) {
        updateWindowData(win.id, { isActive: true });
    }
};

// Pencere açma fonksiyonu
export let openWindow = (id) => {
    const win = document.getElementById(id);
    if (!win) return;

    win.style.display = 'block';

    if (window.innerWidth > 768) {
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
    }

    // Get window title from title bar
    const titleBarText = win.querySelector('.title-bar-text');
    const title = titleBarText ? titleBarText.textContent : id;
    
    // Add to taskbar if not already there
    if (!openWindows.has(id)) {
        addToTaskbar(id, title);
    }

    bringToFront(win);
};

// Pencere kapatma fonksiyonu
export const closeWindow = (win) => {
    win.style.display = 'none';
    win.classList.remove('active');
    
    // Remove from taskbar
    if (win.id) {
        removeFromTaskbar(win.id);
    }
};

export const makeAllWindowsDraggable = () => {
    if (window.innerWidth <= 768) {
        return; // Ekran küçükse sürükleme özelliğini aktif etme
    }

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
const eventType = window.innerWidth <= 768 ? 'click' : 'dblclick';

    document.querySelectorAll('.desktop-icon').forEach(icon => {
        icon.addEventListener(eventType, () => {
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

// Pencere minimizasyonu fonksiyonu
export const minimizeWindow = (win) => {
    win.style.display = 'none';
    win.classList.remove('active');
    
    // Update taskbar to show window as inactive
    if (win.id && openWindows.has(win.id)) {
        updateWindowData(win.id, { isActive: false });
    }
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

// Pencerelerdeki minimizasyon butonları
const setupMinimizeButtons = () => {
    document.querySelectorAll('.minimize-btn').forEach(btn => {
        const windowToMinimize = btn.closest('.window');
        if (windowToMinimize) {
            btn.addEventListener('click', () => minimizeWindow(windowToMinimize));
        }
    });
};

// Pencerelere tıklandığında öne getirme
const setupWindowFocus = () => {
    document.querySelectorAll('.window').forEach(win => {
        win.addEventListener('mousedown', () => bringToFront(win));
    });
};

const addDefaultWindowsToTaskbar = () => {
    document.querySelectorAll('.window').forEach(win => {
        const isVisible = win.style.display !== 'none' && 
                         getComputedStyle(win).display !== 'none';
        
        if (isVisible && !openWindows.has(win.id)) {
            const titleBarText = win.querySelector('.title-bar-text');
            // Extract clean title text (remove icon if present)
            let title = win.id;
            if (titleBarText) {
                // Get text content only, excluding any img elements
                const textNodes = Array.from(titleBarText.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
                title = textNodes.map(node => node.textContent).join('').trim() || titleBarText.textContent;
            }
            addToTaskbar(win.id, title);
        }
    });
};

document.addEventListener('DOMContentLoaded', () => {
    makeAllWindowsDraggable();
    setupDesktopIcons();
    setupCloseButtons();
    setupMinimizeButtons();
    setupWindowFocus();
    addDefaultWindowsToTaskbar();
});