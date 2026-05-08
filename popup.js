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
            document.getElementById(tab.dataset.tab).classList.add('active');
            
            // Ставим фокус в нужное поле при переключении
            if (tab.dataset.tab === 'sd') {
                document.getElementById('ticketInput').focus();
            } else {
                document.getElementById('trackInput').focus();
            }
        });
    });

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
});
