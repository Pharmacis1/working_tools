document.addEventListener('DOMContentLoaded', () => {
    // === ЛОГИКА ВКЛАДОК ===
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Убираем активный класс у всех
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Добавляем активный класс нажатой вкладке
            tab.classList.add('active');
            const tabId = tab.dataset.tab;
            document.getElementById(tabId).classList.add('active');
            
            // Сохраняем выбор
            localStorage.setItem('lastActiveTab', tabId);
            
            // Ставим фокус в нужное поле при переключении
            if (tabId === 'sd') {
                document.getElementById('ticketInput').focus();
            } else if (tabId === 'tracker') {
                document.getElementById('trackInput').focus();
            } else if (tabId === 'assistant') {
                const astInput = document.getElementById('astInput');
                if (astInput && astInput.style.display !== 'none') {
                    astInput.focus();
                }
            }
        });
    });

    // Восстанавливаем последнюю открытую вкладку при загрузке
    const savedTab = localStorage.getItem('lastActiveTab');
    if (savedTab) {
        const tabToActivate = document.querySelector(`.tab[data-tab="${savedTab}"]`);
        if (tabToActivate) {
            tabToActivate.click();
        }
    }

    // === ЛОГИКА SD (Инциденты) ===
    const sdInput = document.getElementById('ticketInput');
    const sdBtn = document.getElementById('searchBtn');

    sdInput.focus();

    function searchIncident() {
        const query = sdInput.value.trim();
        if (query) {
            const encodedNumber = encodeURIComponent(query);
            const url = `https://sd.burgerkingrus.ru/HEAT/Default.aspx?Scope=ObjectWorkspace&CommandId=Search&ObjectType=Incident%23&CommandData=IncidentNumber%2C%3D%2C0%2C${encodedNumber}%2Cstring%2CAND%7C#1761547960716\\`;
            chrome.tabs.create({ url: url });
        }
    }

    sdBtn.addEventListener('click', searchIncident);
    sdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchIncident();
    });

    // === ЛОГИКА ТРЕКЕРА ГРУЗОВ ===
    const companySelect = document.getElementById('companySelect');
    const trackInput = document.getElementById('trackInput');
    const trackBtn = document.getElementById('trackBtn');

    function trackParcel() {
        const query = trackInput.value.trim();
        const company = companySelect.value;
        
        if (!query) return;

        let url = '';
        switch(company) {
            case 'cdek':
                url = `https://www.cdek.ru/ru/tracking?order_id=${encodeURIComponent(query)}`;
                break;
            case 'dellin':
                url = `https://www.dellin.ru/tracker/?mode=search&search=${encodeURIComponent(query)}`;
                break;
            case 'dpd':
                url = `https://www.dpd.ru/ols/trace2/extended.do2?query=${encodeURIComponent(query)}`;
                break;
            case 'kce':
                // Универсальная ссылка на отслеживание КСЭ
                url = `https://www.cse.ru/`; 
                break;
            case 'pony':
                url = `https://www.ponyexpress.ru/support/servisy-samoobsluzhivaniya/tariff/?trace=${encodeURIComponent(query)}`;
                break;
            case 'flippost':
                url = `https://flippost.com/tracking/?number=${encodeURIComponent(query)}`;
                break;
        }

        if (url) {
            chrome.tabs.create({ url: url });
        }
    }

    trackBtn.addEventListener('click', trackParcel);
    trackInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') trackParcel();
    });

    // === ЛОГИКА АССИСТЕНТА ===
    const astModes = document.querySelectorAll('input[name="astMode"]');
    const astInputGroup = document.getElementById('astInputGroup');
    const astInput = document.getElementById('astInput');
    const astBtn = document.getElementById('astBtn');
    
    const assistantOutputGroup = document.getElementById('assistantOutputGroup');
    const assistantOutput = document.getElementById('assistantOutput');
    const btnCopyOutput = document.getElementById('btnCopyOutput');

    function updateAssistantUI() {
        const mode = document.querySelector('input[name="astMode"]:checked').value;
        if (mode === 'generate') {
            astInputGroup.style.display = 'none';
            astBtn.textContent = 'Сгенерировать ID шаблона';
        } else if (mode === 'links') {
            astInputGroup.style.display = 'block';
            astInput.placeholder = 'Например: 1024, 567...';
            astBtn.textContent = 'Сделать из ID РК ссылки';
        } else if (mode === 'format') {
            astInputGroup.style.display = 'block';
            astInput.placeholder = 'Например: 42, 115...';
            astBtn.textContent = 'Отформатировать номера';
        }
        assistantOutputGroup.style.display = 'none';
        astInput.value = '';
    }

    astModes.forEach(radio => radio.addEventListener('change', updateAssistantUI));
    updateAssistantUI();

    function showOutput(text) {
        assistantOutput.textContent = text;
        assistantOutputGroup.style.display = 'block';
    }

    function generateRandomId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    astBtn.addEventListener('click', () => {
        const mode = document.querySelector('input[name="astMode"]:checked').value;
        const text = astInput.value.trim();

        if (mode === 'generate') {
            showOutput(generateRandomId());
        } 
        else if (mode === 'links') {
            if (!text) return showOutput("Пожалуйста, введите ID рекламных кампаний.");
            // Ищем все числа, так как ID РК теперь цифровые
            const numRegex = /\d+/g;
            const matches = text.match(numRegex);
            if (matches && matches.length > 0) {
                const links = matches.map(id => `https://web.burgerkingrus.ru/n/#/campaigns/${id}`);
                showOutput(links.join('\n'));
            } else {
                showOutput("ID рекламных кампаний не найдены. Убедитесь, что вы ввели числа.");
            }
        } 
        else if (mode === 'format') {
            if (!text) return showOutput("Пожалуйста, введите номера ресторанов.");
            // Ищем все числа
            const numRegex = /\d+/g;
            const matches = text.match(numRegex);
            if (matches && matches.length > 0) {
                const formatted = matches.map(num => num.padStart(4, '0'));
                showOutput(formatted.join('\n'));
            } else {
                showOutput("Номера ресторанов не найдены.");
            }
        }
    });

    btnCopyOutput.addEventListener('click', () => {
        const textToCopy = assistantOutput.textContent;
        navigator.clipboard.writeText(textToCopy).then(() => {
            const originalText = btnCopyOutput.textContent;
            btnCopyOutput.textContent = 'Скопировано!';
            setTimeout(() => {
                btnCopyOutput.textContent = originalText;
            }, 2000);
        });
    });
});
