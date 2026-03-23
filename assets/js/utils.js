// utils.js
// Genel yardımcı işlevleri içerir.

// Gereksinim duyulan fonksiyonları windowmanager.js dosyasından import ediyoruz.
import { openWindow, bringToFront, closeWindow, makeAllWindowsDraggable } from './windows.js';

// Duck oluşturucu (duck spawner)
export const setupCatSpawner = () => {
    const catSpawner = document.getElementById('cat-spawner');
    if (!catSpawner) return;

    catSpawner.addEventListener('dblclick', () => {
        const catWindow = document.createElement('div');
        catWindow.className = 'window';
        catWindow.style.position = 'absolute';
        catWindow.style.width = '250px';
        catWindow.style.left = `${Math.random() * (window.innerWidth - 250)}px`;
        catWindow.style.top = `${Math.random() * (window.innerHeight - 250)}px`;

        const catId = `duck_${Date.now()}`;

        catWindow.innerHTML = `
            <div class="title-bar">
                <div class="title-bar-text">${catId}.gif</div>
                <div class="title-bar-controls">
                    <button class="close-btn" aria-label="Close"></button>
                </div>
            </div>
            <div class="window-body">
                <img src="https://random-d.uk/api/randomimg?type=gif&t=${Date.now()}" alt="A random duck gif" style="width:100%;" />
            </div>
        `;
        document.body.appendChild(catWindow);

        // Yeni pencereyi de sürüklenebilir ve kapatılabilir yap
        bringToFront(catWindow);

        // Add draggable functionality
        const titleBar = catWindow.querySelector('.title-bar');
        let isDragging = false;
        let offsetX, offsetY;

        titleBar.addEventListener('mousedown', (e) => {
            isDragging = true;
            offsetX = e.clientX - catWindow.offsetLeft;
            offsetY = e.clientY - catWindow.offsetTop;
            bringToFront(catWindow);
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            let newLeft = e.clientX - offsetX;
            let newTop = e.clientY - offsetY;

            const screenWidth = window.innerWidth;
            const screenHeight = window.innerHeight;
            const winWidth = catWindow.offsetWidth;
            const winHeight = catWindow.offsetHeight;

            if (newLeft < 0) newLeft = 0;
            if (newTop < 0) newTop = 0;
            if (newLeft + winWidth > screenWidth) newLeft = screenWidth - winWidth;
            if (newTop + winHeight > screenHeight) newTop = screenHeight - winHeight;

            catWindow.style.left = `${newLeft}px`;
            catWindow.style.top = `${newTop}px`;
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });

        catWindow.querySelector('.close-btn').addEventListener('click', () => {
            catWindow.remove();
        });
    });
};

// Harici linklerin yeni sekmede açılmasını sağlar
export const setupExternalLinks = () => {
    const links = document.querySelectorAll('a');
    links.forEach(link => {
        const href = link.getAttribute('href');
        if (href && !href.startsWith('#') && !href.startsWith('mailto:')) {
            link.setAttribute('target', '_blank');
        }
    });
};

// Mail gönderme işlevini kurar
export const setupMailSender = () => {
    const sendBtn = document.getElementById('send-mail-btn');
    if (!sendBtn) return;
    
    sendBtn.addEventListener('click', () => {
        const name = document.getElementById("contact_name").value;
        const pronoun = document.getElementById("contact_pronoun").value;
        const subject = document.getElementById("contact_subject").value;
        const reason = document.getElementById("contact_reason").value;
        const notes = document.getElementById("mail_content").value;
        const mailto = `mailto:uluckaymak@gmail.com?subject=${encodeURIComponent(reason + " — " + subject)}&body=${encodeURIComponent(`Hi! I'm ${name}! (${pronoun})\n\n${notes}\n\nBest regards,\n${name}`)}`;
        window.location.href = mailto;
    });
};

// Note App Logic
export const setupNoteApp = () => {
    const textArea = document.getElementById('user-note');
    const noteWindow = document.getElementById('leave-note');
    const statusField = document.getElementById('note-status');

    if (!textArea || !noteWindow) return;

    // Dropdown Toggle Logic
    const menuItems = noteWindow.querySelectorAll('.menubar > li');
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const dropdown = item.querySelector('.context-menu');
            if (dropdown) {
                const isVisible = dropdown.style.display === 'block';
                
                // Close all other dropdowns and remove active classes
                noteWindow.querySelectorAll('.context-menu').forEach(d => d.style.display = 'none');
                noteWindow.querySelectorAll('.menubar > li').forEach(li => li.classList.remove('active'));
                
                if (!isVisible) {
                    dropdown.style.display = 'block';
                    item.classList.add('active');
                }
                e.stopPropagation();
            }
        });
    });

    // Close dropdowns on global click
    document.addEventListener('click', () => {
        noteWindow.querySelectorAll('.context-menu').forEach(d => d.style.display = 'none');
        noteWindow.querySelectorAll('.menubar > li').forEach(li => li.classList.remove('active'));
    });

    // We'll use Dweet.io for shared notes (very reliable for simple messaging)
    const DWEET_THING = 'uluc-guestbook-notepad-v1';
    const API_URL = `https://dweet.io/get/latest/dweet/for/${DWEET_THING}`;

    const fetchSharedNote = async () => {
        if (!noteWindow || noteWindow.style.display === 'none') return;
        
        statusField.textContent = "Checking guestbook...";
        try {
            const response = await fetch(API_URL);
            if (response.ok) {
                const data = await response.json();
                if (data.this === "succeeded" && data.with && data.with.length > 0) {
                    const latest = data.with[0].content;
                    if (latest && latest.note) {
                        textArea.value = latest.note;
                        statusField.textContent = "Global note loaded.";
                    }
                } else {
                    statusField.textContent = "Guestbook is empty.";
                }
            }
        } catch (error) {
            console.error("Dweet fetch error:", error);
            statusField.textContent = "Offline mode.";
            const savedNote = localStorage.getItem('user_note');
            if (savedNote) textArea.value = savedNote;
        }
    };

    // Fetch note whenever the window becomes visible
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'style') {
                const isVisible = noteWindow.style.display !== 'none';
                if (isVisible) fetchSharedNote();
            }
        });
    });
    observer.observe(noteWindow, { attributes: true });

    // Menu Actions
    const handleSave = async () => {
        const note = textArea.value;
        if (note.trim() === "") return alert("Please type something!");
        
        statusField.textContent = "Sending to next user...";
        try {
            const now = new Date();
            const timestamp = `\n\n--- Sent on: ${now.toLocaleDateString()} ${now.toLocaleTimeString()} ---`;
            const finalNote = note.includes('--- Sent on:') ? note : note + timestamp;

            const saveUrl = `https://dweet.io/dweet/for/${DWEET_THING}`;
            const response = await fetch(saveUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ note: finalNote })
            });

            if (response.ok) {
                localStorage.setItem('user_note', finalNote);
                alert("Note saved to global guestbook!");
                statusField.textContent = "Note synced.";
                import('./windows.js').then(mod => mod.closeWindow(noteWindow));
            }
        } catch (e) {
            alert("Error syncing. Saved locally.");
            localStorage.setItem('user_note', note);
            statusField.textContent = "Local save only.";
        }
    };

    const handleAction = (action) => {
        textArea.focus();
        switch(action) {
            case 'undo': document.execCommand('undo'); break;
            case 'cut': document.execCommand('cut'); break;
            case 'copy': document.execCommand('copy'); break;
            case 'paste': 
                navigator.clipboard.readText().then(text => {
                    const start = textArea.selectionStart;
                    const end = textArea.selectionEnd;
                    textArea.value = textArea.value.substring(0, start) + text + textArea.value.substring(end);
                    textArea.selectionStart = textArea.selectionEnd = start + text.length;
                }).catch(() => document.execCommand('paste'));
                break;
            case 'delete':
                const start = textArea.selectionStart;
                textArea.value = textArea.value.substring(0, start) + textArea.value.substring(textArea.selectionEnd);
                textArea.selectionStart = textArea.selectionEnd = start;
                break;
            case 'select-all': textArea.select(); break;
        }
    };

    // Attach Menu Click Listeners
    document.getElementById('menu-save').onclick = handleSave;
    document.getElementById('menu-exit').onclick = () => import('./windows.js').then(mod => mod.closeWindow(noteWindow));
    document.getElementById('menu-undo').onclick = () => handleAction('undo');
    document.getElementById('menu-cut').onclick = () => handleAction('cut');
    document.getElementById('menu-copy').onclick = () => handleAction('copy');
    document.getElementById('menu-paste').onclick = () => handleAction('paste');
    document.getElementById('menu-delete').onclick = () => handleAction('delete');
    document.getElementById('menu-select-all').onclick = () => handleAction('select-all');
    document.getElementById('menu-about').onclick = () => alert("Leave a Note v1.0\nA shared guestbook for Uluç's portfolio.");
};

// Sayfa yüklendiğinde tüm işlevleri başlatır
document.addEventListener('DOMContentLoaded', () => {
    setupCatSpawner();
    setupExternalLinks();
    setupMailSender();
    setupNoteApp();
});