// Функция для проактивного исправления ссылок (чтобы работало сразу, а не при клике)
function fixDownloadLinks() {
    const downloadLinks = document.querySelectorAll('a[download]');
    downloadLinks.forEach(link => {
        link.removeAttribute('download');
        link.setAttribute('target', '_blank');
    });

    // Также фиксим ссылки на картинки без атрибута download
    const allLinks = document.querySelectorAll('a[href]');
    allLinks.forEach(link => {
        const href = (link.getAttribute('href') || '').toLowerCase();
        if (href.includes('.jpg') || href.includes('.jpeg') || href.includes('.png')) {
            if (link.getAttribute('target') !== '_blank') {
                link.setAttribute('target', '_blank');
            }
        }
    });
}

// Слушаем клики как запасной вариант
document.addEventListener('click', function(e) {
  let target = e.target.closest('a');
  if (target) {
    if (target.hasAttribute('download')) {
      target.removeAttribute('download');
      target.setAttribute('target', '_blank');
    }
  }
}, true);

// --- ИНТЕГРАЦИЯ ДЛЯ WEB.BURGERKINGRUS.RU (Шаблоны -> Проекты) ---
const isBKPortal = window.location.hostname === 'web.burgerkingrus.ru';
const isSDPage = window.location.hostname === 'sd.burgerkingrus.ru';
const isTestMode = window.location.protocol === 'file:' || window.location.hostname === 'localhost';

if (isSDPage) {
    console.log("[BK Extension] SD Page script active in frame:", window.location.href);
    
    async function findRestaurantNumber() {
        if (!chrome.runtime?.id) return null;

        const restRegex = /(\d{4})[-−–—][А-ЯЁA-Z]{2,}/i;

        try {
            // 1. Сначала ищем в текущем фрейме (самый свежий источник)
            const text = document.body.innerText;
            const match = text.match(restRegex);
            if (match) {
                const res = match[1];
                await chrome.storage.local.set({ 'last_rest_num': res });
                return res;
            }

            const inputs = document.querySelectorAll('input, textarea');
            for (let input of inputs) {
                const valMatch = (input.value || '').match(restRegex);
                if (valMatch) {
                    const res = valMatch[1];
                    await chrome.storage.local.set({ 'last_rest_num': res });
                    return res;
                }
            }

            // 2. Если в этом фрейме нет, пробуем взять из кэша (другие фреймы могли найти)
            const storage = await chrome.storage.local.get('last_rest_num');
            return storage.last_rest_num || null;
        } catch (e) {
            return null;
        }
    }

    async function updateSDRestaurantLinks() {
        const restNum = await findRestaurantNumber();
        if (!restNum) return;

        const restRegex = new RegExp(`(${restNum})([-−–—][А-ЯЁA-Z]{2,})`, 'i');
        
        // 1. Ищем в текстовых узлах
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while (node = walker.nextNode()) {
            const parent = node.parentElement;
            if (!parent || ['SCRIPT', 'STYLE', 'A', 'TEXTAREA', 'INPUT'].includes(parent.tagName)) continue;
            if (parent.dataset.bkRestProcessed) continue;

            const text = node.nodeValue;
            if (text && text.includes(restNum) && restRegex.test(text)) {
                const wrapper = document.createElement('span');
                const link = `<a href="https://web.burgerkingrus.ru/n/#/devs?sd_rest=${restNum}" target="_blank" style="color: #d35400; text-decoration: underline; font-weight: bold; cursor: pointer;">${restNum}</a>`;
                
                wrapper.innerHTML = text.replace(restNum, link);
                parent.replaceChild(wrapper, node);
                parent.dataset.bkRestProcessed = "true";
                console.log("[BK Extension] Restaurant code linked in text:", restNum);
            }
        }

        // 2. Ищем в инпутах и текстареа (добавляем кнопку поверх)
        const fields = document.querySelectorAll('input, textarea');
        fields.forEach(field => {
            if (field.dataset.bkRestProcessed) return;
            const val = field.value || '';
            if (val.includes(restNum) && restRegex.test(val)) {
                field.dataset.bkRestProcessed = "true";
                
                // Создаем обертку для позиционирования
                const wrapper = document.createElement('div');
                wrapper.className = 'bk-field-wrapper';
                wrapper.style.cssText = `
                    position: relative;
                    display: inline-block;
                    width: ${field.offsetWidth ? field.offsetWidth + 'px' : '100%'};
                    vertical-align: middle;
                `;
                
                const btn = document.createElement('a');
                btn.href = `https://web.burgerkingrus.ru/n/#/devs?sd_rest=${restNum}`;
                btn.target = '_blank';
                btn.textContent = '🖥️ Устройства';
                btn.title = 'Открыть устройства ресторана ' + restNum;
                btn.style.cssText = `
                    position: absolute;
                    right: 2px;
                    top: 2px;
                    z-index: 100;
                    padding: 1px 6px;
                    background: #d35400;
                    color: #fff !important;
                    border-radius: 4px;
                    text-decoration: none;
                    font-size: 10px;
                    font-weight: bold;
                    cursor: pointer;
                    white-space: nowrap;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                    opacity: 0.9;
                `;
                
                // Перемещаем поле внутрь обертки
                field.parentNode.insertBefore(wrapper, field);
                wrapper.appendChild(field);
                wrapper.appendChild(btn);
                
                console.log("[BK Extension] Search badge added OVER field for rest:", restNum);
            }
        });
    }

    // Очищаем кэш при смене URL (переключении между заявками)
    let lastUrl = location.href;
    setInterval(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            if (window.top === window) {
                try { chrome.storage.local.remove('last_rest_num'); } catch(e) {}
            }
        }
    }, 1000);

    setInterval(updateSDRestaurantLinks, 2000);
}

if (isBKPortal || isTestMode) {
    let projectMap = {};
    let deviceNames = [];
    let lastUrl = location.href;

    // Загружаем сохраненную карту проектов из локального хранилища (чтобы работало в новых вкладках)
    chrome.storage.local.get('bk_project_map', (data) => {
        if (data.bk_project_map) {
            // Мержим с тем, что могло уже прийти через сообщения за время инициализации
            projectMap = { ...data.bk_project_map, ...projectMap };
            console.log("[BK Extension] Project map loaded and merged from storage:", Object.keys(projectMap).length, "items");
        }
    });

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
                chrome.storage.local.set({ 'bk_project_map': projectMap });
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
        const hash = window.location.hash;
        if (!isTestMode && !hash.includes('/campaigns/') && !hash.includes('/campaigns2/')) return;

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
        
        const hash = window.location.hash;
        if (!isTestMode && !hash.includes('/campaigns/') && !hash.includes('/campaigns2/')) return;

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

    // --- ФУНКЦИИ ДЛЯ РАБОТЫ С КАМПАНИЯМИ (РК) ---

    // 5. Добавление поля для суффикса и переключателя в "Зону медиа"
    async function updateCampaignSuffixUI() {
        let settingsBar = document.querySelector('.settings_U7Tv .btns_eTuf');
        
        // Если не нашли по точному классу (например, в многозонных РК), ищем по содержимому
        if (!settingsBar) {
            const allBtnGroups = document.querySelectorAll('[class*="btns_"]');
            for (const group of allBtnGroups) {
                const text = group.textContent.toUpperCase();
                if (text.includes('ПРАВИЛА') || text.includes('НАСТРОЙКИ')) {
                    settingsBar = group;
                    break;
                }
            }
        }

        if (!settingsBar || document.getElementById('bk-search-suffix-wrapper')) return;

        // Загружаем настройки
        const data = await chrome.storage.local.get(['bk_search_suffix', 'bk_search_enabled']);
        const isEnabled = data.bk_search_enabled !== false; // По умолчанию включено

        const wrapper = document.createElement('div');
        wrapper.id = 'bk-search-suffix-wrapper';
        wrapper.style.cssText = `
            display: flex;
            align-items: center;
            margin-right: 10px;
            background: #f0f2f5;
            border-radius: 4px;
            padding: 2px 8px;
            border: 1px solid #dcdfe6;
            gap: 5px;
        `;

        // Чекбокс ВКЛ/ВЫКЛ
        const toggle = document.createElement('input');
        toggle.type = 'checkbox';
        toggle.checked = isEnabled;
        toggle.title = 'Включить автоподстановку в поиск';
        toggle.style.cssText = 'cursor: pointer; margin: 0;';
        toggle.onchange = (e) => {
            chrome.storage.local.set({ 'bk_search_enabled': e.target.checked });
        };

        const label = document.createElement('span');
        label.textContent = 'Суффикс:';
        label.style.cssText = 'font-size: 11px; color: #606266; font-weight: bold; margin-left: 2px;';

        const input = document.createElement('input');
        input.id = 'bk-search-suffix-input';
        input.placeholder = 'напр. 13.05';
        input.value = data.bk_search_suffix || '';

        input.style.cssText = `
            border: none;
            background: transparent;
            font-size: 11px;
            width: 70px;
            outline: none;
            color: #333;
        `;

        input.oninput = (e) => {
            chrome.storage.local.set({ 'bk_search_suffix': e.target.value });
        };

        wrapper.appendChild(toggle);
        wrapper.appendChild(label);
        wrapper.appendChild(input);
        settingsBar.prepend(wrapper);
    }

    // 6. Автозаполнение поиска в модальном окне
    async function handleCampaignModalSearch() {
        const searchInput = document.querySelector('.searchWrapper_Y8fp .input-text_1428915500_ui');
        if (!searchInput) return;

        // Проверяем, включена ли функция
        const config = await chrome.storage.local.get('bk_search_enabled');
        if (config.bk_search_enabled === false) {
            console.log("[BK Extension] Auto-search disabled in config.");
            return;
        }

        // 1. Получаем имя активной сцены (пробуем разные селекторы)
        let activeSceneEl = document.querySelector('.select_XMMv .text_RLUu.text') 
                         || document.querySelector('.select_XMMv [class*="text_"]')
                         || document.querySelector('[class*="select_"] [class*="text_"]');
        
        if (!activeSceneEl) {
            console.log("[BK Extension] Active scene element NOT found.");
            return;
        }
        const sceneName = activeSceneEl.textContent.trim();

        // 2. Получаем суффикс
        const data = await chrome.storage.local.get('bk_search_suffix');
        const suffix = data.bk_search_suffix || '';

        const fullSearchQuery = `${sceneName} ${suffix}`.trim();
        
        // Если этот запрос мы уже вставляли в ЭТОТ конкретный инпут - ничего не делаем
        if (searchInput.dataset.bkLastQuery === fullSearchQuery) return;

        console.log("[BK Extension] Auto-filling campaign search:", fullSearchQuery);
        searchInput.dataset.bkLastQuery = fullSearchQuery;
        
        // Вставляем значение
        try {
            const nativeValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            nativeValueSetter.call(searchInput, fullSearchQuery);
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            searchInput.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (e) {
            console.error("[BK Extension] Error setting search value:", e);
        }

        // Enter
        setTimeout(() => {
            console.log("[BK Extension] Triggering search click/enter...");
            searchInput.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true
            }));
            const icon = searchInput.parentElement.querySelector('.searchIcon_B5XL');
            if (icon) icon.click();
        }, 300);
    }

    // 5. Авто-поиск по параметру sd_rest
    function handleAutoSearch() {
        if (!window.location.hash.includes('/devs')) return;
        
        const hash = window.location.hash;
        const searchPart = hash.includes('?') ? hash.split('?')[1] : window.location.search.substring(1);
        const params = new URLSearchParams(searchPart);
        const restNum = params.get('sd_rest');
        
        if (!restNum) return;

        console.log("[BK Extension] Auto-searching for restaurant:", restNum);

        // Убираем параметр из URL, чтобы не частить при перезагрузке
        if (hash.includes('sd_rest')) {
            const cleanHash = hash.split('?')[0];
            history.replaceState(null, '', window.location.pathname + window.location.search + cleanHash);
        }

        let attempts = 0;
        const interval = setInterval(() => {
            attempts++;
            // Ищем инпут или текстареа
            const allInputs = document.querySelectorAll('textarea[placeholder*="Поиск"], input[placeholder*="Поиск"], .ant-input');
            let input = null;
            
            // Приоритет тому, который НЕ в боковой панели (фильтре)
            for (let el of allInputs) {
                if (!el.closest('[class*="filter"]') && !el.closest('[class*="sidebar"]') && !el.closest('[class*="Filter"]')) {
                    input = el;
                    break;
                }
            }
            if (!input && allInputs.length > 0) input = allInputs[0];
            
            if (input) {
                const targetValue = restNum; // Пробуем БЕЗ звездочки
                
                if (attempts % 5 === 0) {
                    console.log("[BK Extension] Target found! Attempt:", attempts, "Value:", input.value);
                }

                // Если значение уже установилось
                if (input.value === targetValue) {
                    if (!input.dataset.bkTriggeredAt) {
                        console.log("[BK Extension] Value set! Stage 1 trigger...");
                        input.dataset.bkTriggeredAt = Date.now();
                        triggerSearch(input);
                    } else {
                        const elapsed = Date.now() - parseInt(input.dataset.bkTriggeredAt);
                        // Вторая попытка через 2 секунды (имитация "повторного перехода")
                        if (elapsed > 2000 && !input.dataset.bkStage2) {
                            console.log("[BK Extension] Stage 2 trigger (Double-check)...");
                            input.dataset.bkStage2 = "true";
                            triggerSearch(input);
                        }
                    }
                    
                    // Не выходим сразу, следим еще 10 секунд, чтобы значение не сбросилось
                    if (attempts > 30) clearInterval(interval);
                    return;
                }

                // Эмуляция ввода
                input.focus();
                
                try {
                    const proto = input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
                    const nativeValueSetter = Object.getOwnPropertyDescriptor(proto, "value").set;
                    nativeValueSetter.call(input, targetValue);
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                } catch (e) {}

                try {
                    input.select();
                    document.execCommand('insertText', false, targetValue);
                } catch (e) {}
            }
            
            if (attempts > 40) {
                console.log("[BK Extension] Auto-search timeout.");
                clearInterval(interval);
            }
        }, 500);

        function triggerSearch(el) {
            el.focus();
            el.blur();
            const events = ['keydown', 'keypress', 'keyup'];
            events.forEach(type => {
                el.dispatchEvent(new KeyboardEvent(type, {
                    key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true
                }));
            });
            
            setTimeout(() => {
                const searchBtn = el.closest('div')?.parentElement?.querySelector('span[title="Поиск"], .searchBtn_-668498284_ui');
                if (searchBtn) searchBtn.click();
            }, 300);
        }
    }

    // 6. Следим за изменениями (проверяем часто)
    setInterval(() => {
        fixDownloadLinks();
        const hash = window.location.hash;
        const isCampaignPage = hash.includes('/campaigns/') || hash.includes('/campaigns2/');

        if (isCampaignPage) {
            updateTemplateLinks();
            updateDevicesDisplay();
            updateCampaignSuffixUI();
            handleCampaignModalSearch();
        }
        
        if (hash.includes('/devs')) {
            // Проверяем наличие параметра в URL при смене хэша
            if (hash.includes('sd_rest=')) {
                handleAutoSearch();
            }
        }
    }, 2000);

    // Запускаем проверку сразу
    handleAutoSearch();
}
