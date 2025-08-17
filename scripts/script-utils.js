// utils.js
// Genel yardımcı işlevleri içerir.

// Gereksinim duyulan fonksiyonları windowmanager.js dosyasından import ediyoruz.
import { openWindow, bringToFront, closeWindow, makeAllWindowsDraggable } from './windowmanager.js';

// Kedi oluşturucu
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

        const catId = `cat_${Date.now()}`;

        catWindow.innerHTML = `
            <div class="title-bar">
                <div class="title-bar-text">${catId}.gif</div>
                <div class="title-bar-controls">
                    <button class="close-btn" aria-label="Close"></button>
                </div>
            </div>
            <div class="window-body">
                <img src="https://cataas.com/cat/gif?${Date.now()}" alt="A random cat gif" style="width:100%;" />
            </div>
        `;
        document.body.appendChild(catWindow);

        // Yeni pencereyi de sürüklenebilir ve kapatılabilir yap
        bringToFront(catWindow);

        catWindow.querySelector('.title-bar').addEventListener('mousedown', () => {
             bringToFront(catWindow);
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

// Sayfa yüklendiğinde tüm işlevleri başlatır
document.addEventListener('DOMContentLoaded', () => {
    setupCatSpawner();
    setupExternalLinks();
    setupMailSender();
});