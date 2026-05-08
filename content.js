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

    // 4. Функция для вывода списка устройств (иконка + всплывающее окно)
    function updateDevicesDisplay() {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            deviceNames = [];
            const oldIcon = document.getElementById('bk-devices-icon');
            if (oldIcon) oldIcon.remove();
            const oldPopup = document.getElementById('bk-devices-popup');
            if (oldPopup) oldPopup.remove();
        }

        if (!deviceNames || deviceNames.length === 0) return;
        if (!window.location.hash.includes('/campaigns2/')) return;

        // Ищем внутренний span с «Устройства:» (лист без детей)
        let innerSpan = null;
        const allEls = document.querySelectorAll('span, div, button');
        for (let el of allEls) {
            if (el.children.length === 0 && el.textContent.trim().startsWith('Устройства:')) {
                innerSpan = el;
                break;
            }
        }
        if (!innerSpan) return;

        // Родитель — это сама кнопка целиком
        const buttonEl = innerSpan.parentElement;

        // Если иконка уже есть — ничего не делаем
        if (document.getElementById('bk-devices-icon')) return;

        // Создаём иконку-корону
        const icon = document.createElement('span');
        icon.id = 'bk-devices-icon';
        icon.textContent = ' 👑';
        icon.title = 'Показать список устройств';
        icon.style.cssText = `
            cursor: pointer;
            font-size: 14px;
            margin-left: 4px;
            vertical-align: middle;
            transition: transform 0.2s;
        `;
        icon.onmouseenter = () => icon.style.transform = 'scale(1.3)';
        icon.onmouseleave = () => icon.style.transform = 'scale(1)';

        // Вставляем в КОНЕЦ кнопки (после числа)
        buttonEl.appendChild(icon);

        // Создаём всплывающее окно (скрыто по умолчанию)
        const popup = document.createElement('div');
        popup.id = 'bk-devices-popup';
        popup.style.cssText = `
            display: none;
            position: fixed;
            z-index: 999999;
            background: #fff;
            border: 1px solid #ffd8a8;
            border-left: 5px solid #d35400;
            border-radius: 10px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.18);
            padding: 16px 20px;
            min-width: 280px;
            max-width: 420px;
            max-height: 300px;
            overflow-y: auto;
        `;

        const popupHeader = document.createElement('div');
        popupHeader.style.cssText = `
            color: #d35400;
            font-weight: 800;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 10px;
            padding-bottom: 8px;
            border-bottom: 1px solid #ffecd2;
        `;
        popupHeader.textContent = '📍 Подключенные устройства (' + deviceNames.length + ')';

        const popupList = document.createElement('div');
        popupList.style.cssText = `font-size: 13px; color: #333; line-height: 1.8;`;

        deviceNames.forEach(name => {
            const item = document.createElement('div');
            item.textContent = name;
            item.style.cssText = `
                padding: 3px 8px;
                border-radius: 4px;
                margin-bottom: 2px;
                background: #fef9f3;
            `;
            popupList.appendChild(item);
        });

        popup.appendChild(popupHeader);
        popup.appendChild(popupList);
        document.body.appendChild(popup);

        // Показать/скрыть по клику на иконку
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            if (popup.style.display === 'none') {
                const rect = icon.getBoundingClientRect();
                popup.style.display = 'block';
                popup.style.top = (rect.bottom + 8) + 'px';
                popup.style.left = Math.min(rect.left, window.innerWidth - 440) + 'px';
            } else {
                popup.style.display = 'none';
            }
        });

        // Закрыть по клику вне окна
        document.addEventListener('click', (e) => {
            if (!popup.contains(e.target) && e.target !== icon) {
                popup.style.display = 'none';
            }
        });
    }

    // 5. Следим за изменениями (проверяем часто)
    setInterval(() => {
        if (window.location.hash.includes('/campaigns2/')) {
            updateTemplateLinks();
            updateDevicesDisplay();
        }
    }, 2000);
}
