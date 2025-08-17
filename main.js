document.addEventListener('DOMContentLoaded', () => {
    // --- Global Değişkenler ---
    let highestZIndex = 20;
    let projectsData = [];

    // Tüm a etiketlerini seç
    const links = document.querySelectorAll('a');

    // Her bir a etiketi için döngü oluştur
    links.forEach(link => {
        const href = link.getAttribute('href');

        // Eğer link bir "mailto" bağlantısı değilse ve aynı sayfayı işaret etmiyorsa
        if (href && !href.startsWith('#') && !href.startsWith('mailto:')) {
            link.setAttribute('target', '_blank');
        }
    });

    // Tüm pencereleri sürüklenebilir yap
    const makeAllWindowsDraggable = () => {
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

                // Ekran sınırları kontrolü
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

    // Pencereyi en üste ve öne getir
    const bringToFront = (win) => {
        // Diğer tüm pencerelerden 'active' classını kaldır
        document.querySelectorAll('.window.active').forEach(activeWin => {
            activeWin.classList.remove('active');
        });
        // Tıklanan pencereye 'active' classını ekle
        win.classList.add('active');
        win.style.zIndex = ++highestZIndex;
    };

    // Pencere açma fonksiyonu
    const openWindow = (id) => {
        const win = document.getElementById(id);
        if (!win) return;

        win.style.display = 'block';

        // Pencereyi her zaman ortala
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const width = win.offsetWidth;
        const height = win.offsetHeight;

        // Pencerenin ekran dışına taşmasını engelle
        let newLeft = (vw - width) / 2;
        let newTop = (vh - height) / 2;

        if (newLeft < 0) newLeft = 0;
        if (newTop < 0) newTop = 0;

        win.style.left = `${newLeft}px`;
        win.style.top = `${newTop}px`;

        bringToFront(win);
    };

    // Pencere kapatma fonksiyonu
    const closeWindow = (win) => {
        win.style.display = 'none';
    };

    // --- Proje Verilerini Yükleme ---
    const loadProjects = async () => {
        try {
            const response = await fetch('projects.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const allProjects = await response.json();
            projectsData = allProjects.filter(p => p.enabled);

            populateProjectsTable();
            populateProjectsFolder();
        } catch (error) {
            console.error('Error loading projects:', error);
            // Hata durumunda kullanıcıya bilgi ver
            document.getElementById('portfolio-projects-body').innerHTML = '<tr><td colspan="3">Error loading projects.</td></tr>';
            document.getElementById('project-grid').innerHTML = '<p>Error loading projects.</p>';
        }
    };

    // Proje tablosunu doldur
    const populateProjectsTable = () => {
        const tbody = document.getElementById('portfolio-projects-body');
        const openBtn = document.getElementById('open-project-btn');
        let selectedProject = null; // Seçili projeyi takip etmek için değişken

        tbody.innerHTML = '';
        document.getElementById('project-count-table').textContent = projectsData.length;

        projectsData.forEach(proj => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${proj.title}</td><td>${proj.type}</td><td>${proj.date}</td>`;
            tr.style.cursor = 'pointer';

            // Satıra tıklandığında
            tr.addEventListener('click', () => {
                // Önceki seçimi kaldır
                const prev = tbody.querySelector('tr.highlighted');
                if (prev) {
                    prev.classList.remove('highlighted');
                }

                // Yeni seçimi ekle
                tr.classList.add('highlighted');
                selectedProject = proj;

                // Butonu aktif et ve tıklama olayını ayarla
                openBtn.disabled = false;
                openBtn.onclick = () => showProjectDetail(selectedProject);
            });

            // Satıra çift tıklandığında projeyi doğrudan aç
            tr.addEventListener('dblclick', () => showProjectDetail(proj));

            tbody.appendChild(tr);
        });

        // Başlangıçta butonu devre dışı bırak
        openBtn.disabled = true;
    };

    // Proje klasörünü doldur
    const populateProjectsFolder = () => {
        const grid = document.getElementById('project-grid');
        grid.innerHTML = '';
        document.getElementById('project-count-folder').textContent = projectsData.length;

        projectsData.forEach(project => {
            const shortcut = document.createElement('div');
            shortcut.className = 'project-shortcut';
            shortcut.innerHTML = `
                <img src="${project.thumbnail}" alt="${project.title}" />
                <div>${project.title}</div>
            `;
            shortcut.addEventListener('dblclick', () => showProjectDetail(project));
            grid.appendChild(shortcut);
        });
    };

    // Proje detay penceresini göster
    const showProjectDetail = (project) => {
        const detailWin = document.getElementById('project-detail');
        document.getElementById('project-title').textContent = project.title;
        const contentElem = document.getElementById('project-content');

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
        openWindow('project-detail');

        // Olay dinleyici (event listener)
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
        mediaWin.style.maxWidth = '1280px'; // Pencerenin maksimum genişliğini 1280px olarak sınırlar
        mediaWin.style.maxHeight = '720px'; // Pencerenin maksimum yüksekliğini 720px olarak sınırlar
        mediaWin.style.zIndex = '15';

        // Pencereyi rastgele bir konumda aç
        mediaWin.style.left = `${Math.random() * (window.innerWidth - 300)}px`;
        mediaWin.style.top = `${Math.random() * (window.innerHeight - 300)}px`;

        const isVideo = src.endsWith('.mp4') || src.endsWith('.mov') || src.endsWith('.webm');

        let mediaContent = '';

        if (isVideo) {
            mediaContent = `<video src="${src}" controls style="max-width: 100%; max-height: 100%;"></video>`;
        } else {
            mediaContent = `<img src="${src}" alt="${title}" style="max-width: 100%; max-height: 100%;" />`;
        }

        mediaWin.innerHTML = `
        <div class="title-bar">
            <div class="title-bar-text">${title}</div>
            <div class="title-bar-controls">
                <button class="close-btn" aria-label="Close"></button>
            </div>
        </div>
        <div class="window-body" style="padding: 10px; overflow: auto;">
            ${mediaContent}
        </div>
    `;

        document.body.appendChild(mediaWin);

        // Pencereyi ortala (eğer ilk kez açılıyorsa)
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const width = mediaWin.offsetWidth;
        const height = mediaWin.offsetHeight;
        let newLeft = (vw - width) / 2;
        let newTop = (vh - height) / 2;

        if (newLeft < 0) newLeft = 0;
        if (newTop < 0) newTop = 0;

        mediaWin.style.left = `${newLeft}px`;
        mediaWin.style.top = `${newTop}px`;

        // Yeni pencereyi sürüklenebilir ve kapatılabilir yap
        makeAllWindowsDraggable();
        mediaWin.querySelector('.close-btn').addEventListener('click', () => closeWindow(mediaWin));
        bringToFront(mediaWin);
    };


    // --- Event Listeners (Olay Dinleyicileri) ---

    // Masaüstü ikonlarına çift tıklama
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

    // Pencerelerdeki kapatma butonları
    document.querySelectorAll('.close-btn').forEach(btn => {
        const windowToClose = btn.closest('.window');
        if (windowToClose) {
            btn.addEventListener('click', () => closeWindow(windowToClose));
        }
    });

    // Pencerelere tıklandığında öne getirme
    document.querySelectorAll('.window').forEach(win => {
        win.addEventListener('mousedown', () => bringToFront(win));
    });

    // Kedi oluşturucu
    document.getElementById('cat-spawner').addEventListener('dblclick', () => {
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
        makeAllWindowsDraggable();
        catWindow.querySelector('.close-btn').addEventListener('click', () => closeWindow(catWindow));
        bringToFront(catWindow);
    });

    // Mail gönderme butonu
    document.getElementById('send-mail-btn').addEventListener('click', () => {
        const name = document.getElementById("contact_name").value;
        const pronoun = document.getElementById("contact_pronoun").value;
        const subject = document.getElementById("contact_subject").value;
        const reason = document.getElementById("contact_reason").value;
        const notes = document.getElementById("mail_content").value;
        const mailto = `mailto:uluckaymak@gmail.com?subject=${encodeURIComponent(reason + " — " + subject)}&body=${encodeURIComponent(`Hi! I'm ${name}! (${pronoun})\n\n${notes}\n\nBest regards,\n${name}`)}`;
        window.location.href = mailto;
    });

    // --- Başlangıç Fonksiyonları ---
    makeAllWindowsDraggable();
    loadProjects();
    // openWindow('welcome'); // Sayfa açıldığında welcome penceresini aç
});