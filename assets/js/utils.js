// utils.js
// Genel yardımcı işlevleri içerir.

// Gereksinim duyulan fonksiyonları windowmanager.js dosyasından import ediyoruz.
import { openWindow, bringToFront, closeWindow, makeAllWindowsDraggable } from './windows.js';

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

    // We'll use a Google Apps Script Web App as a permanent, unblockable backend.
    const API_URL = 'https://script.google.com/macros/s/AKfycbxXLiJ1WpjWJJMDYrIZC73isAvE-RfQZxK2MJQcbqseruVVb9eidilI_9Dk0O-sfo0A/exec';

    const fetchSharedNote = async () => {
        if (!noteWindow || noteWindow.style.display === 'none') return;
        
        statusField.textContent = "leave your note...";
        try {
            // Google Scripts usually requires following redirects, which fetch does by default
            const response = await fetch(API_URL);
            if (response.ok) {
                const note = await response.text();
                if (note && note !== "null") {
                    textArea.value = note;
                    statusField.textContent = "a note retrieved.";
                }
            }
        } catch (error) {
            console.error("Fetch error:", error);
            statusField.textContent = "you're alone.";
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
        if (note.trim() === "") return alert("type something!");
        
        const saveMenuItem = document.getElementById('menu-save');
        statusField.textContent = "updating...";
        if (saveMenuItem) saveMenuItem.style.opacity = "0.5";

        const now = new Date();
        const timestamp = `\n\n--- Sent on: ${now.toLocaleDateString()} ${now.toLocaleTimeString()} ---`;
        const finalNote = note.includes('--- Sent on:') ? note : note + timestamp;

        try {
            // Google Scripts handles POST for writing
            const response = await fetch(API_URL, {
                method: 'POST',
                mode: 'no-cors', // Use no-cors for Google Script POST if needed
                body: finalNote
            });

            // With no-cors, we can't check response.ok, but it usually sends
            localStorage.setItem('user_note', finalNote);
            alert("Note broadcasted to the global net!");
            statusField.textContent = "note sent.";
            import('./windows.js').then(mod => mod.closeWindow(noteWindow));
        } catch (e) {
            console.error("Save error:", e);
            alert("error. saved locally.");
            localStorage.setItem('user_note', note);
            statusField.textContent = "local save only.";
        }
        if (saveMenuItem) saveMenuItem.style.opacity = "1";
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
    setupExternalLinks();
    setupMailSender();
    setupNoteApp();
});