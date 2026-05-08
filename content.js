// Слушаем все клики на странице (перехват на этапе погружения)
document.addEventListener('click', function(e) {
  // Ищем ближайший тег <a> (ссылку), по которому кликнули
  let target = e.target.closest('a');
  
  if (target) {
    // 1. Проверяем, есть ли у ссылки атрибут download, который заставляет браузер скачивать файл
    if (target.hasAttribute('download')) {
      target.removeAttribute('download');
      target.setAttribute('target', '_blank'); // заставляем открыться в новой вкладке
    }
    
    // 2. На некоторых сайтах ссылка на скачивание может быть Blob-объектом
    // В таких случаях лучше дать браузеру попытаться открыть его в новой вкладке
    let href = target.getAttribute('href');
    if (href && (href.toLowerCase().includes('.jpg') || href.toLowerCase().includes('.jpeg') || href.toLowerCase().includes('.png'))) {
        target.setAttribute('target', '_blank');
    }
  }
}, true);

// --- ИНТЕГРАЦИЯ ДЛЯ WEB.BURGERKINGRUS.RU (Шаблоны -> Проекты) ---
if (window.location.hostname === 'web.burgerkingrus.ru') {
    let projectMap = {};
    let deviceNames = [];
    let lastUrl = location.href;

    try {
        const cached = sessionStorage.getItem('bk_project_map');
        if (cached) projectMap = JSON.parse(cached);
    } catch(e) {}

    console.log("[BK Extension] Content script started.");

    // 1. Внедряем внешний скрипт-перехватчик
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('inject.js');
    (document.head || document.documentElement).appendChild(script);
    script.onload = () => script.remove();

    // 2. Слушаем сообщения от перехватчика
    window.addEventListener('message', function(event) {
        if (event.source !== window) return;
        
        if (event.data.type === 'BK_PROJECTS_DATA') {
            let added = 0;
            event.data.projects.forEach(p => {
                if (p.name && p.id) {
                    const name = p.name.trim();
                    if (!projectMap[name]) {
                        projectMap[name] = p.id;
                        added++;
                    }
                }
            });
            if (added > 0) {
                sessionStorage.setItem('bk_project_map', JSON.stringify(projectMap));
            }
            updateTemplateLinks();
        }

        if (event.data.type === 'BK_DEVICES_DATA') {
            const devices = event.data.devices || [];
            if (devices.length > 500) return;

            const newNames = devices.map(d => d.name || d.id).filter(Boolean);
            const isJustIds = newNames.every(val => !isNaN(val));
            const currentHasNames = deviceNames.length > 0 && deviceNames.some(val => isNaN(val));
            
            if (isJustIds && currentHasNames) return;

            deviceNames = newNames;
            updateDevicesDisplay();
        }
    });

    // 3. Функция поиска и замены для шаблонов
    function updateTemplateLinks() {
        if (!window.location.hash.includes('/campaigns2/')) return;

        const spans = document.querySelectorAll('div[class*="firstLine_"] span, div[class*="wrapper_"] span');
        spans.forEach(span => {
            if (span.dataset.processed) return;
            const name = span.textContent.trim().replace(/\u00a0/g, ' ');
            
            if (projectMap[name]) {
                const projectId = projectMap[name];
                const a = document.createElement('a');
                a.href = `/n/#/projects/${projectId}`;
                a.target = '_blank';
                a.style.cssText = 'text-decoration: underline; color: #1890ff; font-weight: bold; cursor: pointer;';
                a.title = "Открыть шаблон";
                
                span.parentNode.insertBefore(a, span);
                a.appendChild(span);
                span.dataset.processed = "true";
            }
        });
    }

    // 4. Функция для вывода списка устройств
    function updateDevicesDisplay() {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            deviceNames = [];
            const old = document.getElementById('bk-devices-list-wrapper');
            if (old) old.remove();
        }

        if (!deviceNames || deviceNames.length === 0) return;
        if (!window.location.hash.includes('/campaigns2/')) return;

        let anchor = null;
        const allElements = document.querySelectorAll('div, span, b');
        for (let el of allElements) {
            if (el.textContent.trim() === 'Места') {
                anchor = el;
                break;
            }
        }
        if (!anchor) return;

        const sectionRow = anchor.closest('div[class*="block_"]') || anchor.parentElement.parentElement;
        const parentContainer = sectionRow.parentElement;

        let listContainer = document.getElementById('bk-devices-list-wrapper');
        if (!listContainer) {
            listContainer = document.createElement('div');
            listContainer.id = 'bk-devices-list-wrapper';
            listContainer.style.cssText = `
                display: block;
                width: 95%;
                margin: 10px auto 15px auto;
                padding: 10px 15px;
                background: #fff9f0;
                border: 1px solid #ffd8a8;
                border-left: 5px solid #d35400;
                border-radius: 6px;
                box-shadow: 0 2px 8px rgba(211, 84, 0, 0.1);
                box-sizing: border-box;
                clear: both;
            `;

            const header = document.createElement('div');
            header.innerHTML = '<span style="color: #d35400; font-weight: bold; font-size: 11px; text-transform: uppercase;">📍 Подключенные устройства:</span>';
            header.style.marginBottom = '5px';
            
            const scrollArea = document.createElement('div');
            scrollArea.id = 'bk-devices-scroll-area';
            scrollArea.style.cssText = `
                max-height: 80px;
                overflow-y: auto;
                font-size: 13px;
                color: #444;
                line-height: 1.4;
                font-weight: 500;
            `;

            listContainer.appendChild(header);
            listContainer.appendChild(scrollArea);
            sectionRow.parentNode.insertBefore(listContainer, sectionRow.nextSibling);
            console.log("[BK Extension] Device list block created and inserted");
        }

        // 4. Обновляем текст
        const scrollArea = document.getElementById('bk-devices-scroll-area');
        if (scrollArea) {
            scrollArea.textContent = deviceNames.join(', ');
        }
    }

    // 5. Следим за изменениями (проверяем часто)
    setInterval(() => {
        if (window.location.hash.includes('/campaigns2/')) {
            updateTemplateLinks();
            updateDevicesDisplay();
        }
    }, 2000);
}
