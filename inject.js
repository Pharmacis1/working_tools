(function() {
    console.log("[BK Extension] Injector v6 (Ultra-Safe) loaded");

    function findAndSendData(obj) {
        if (!obj || typeof obj !== 'object') return;
        
        // Только верхний уровень, никакой рекурсии!
        if (Array.isArray(obj.projects)) {
            window.postMessage({ type: 'BK_PROJECTS_DATA', projects: obj.projects }, '*');
        }
        if (Array.isArray(obj.devices)) {
            window.postMessage({ type: 'BK_DEVICES_DATA', devices: obj.devices }, '*');
        }

        // Если данные вложены в "data" (частая практика)
        if (obj.data && typeof obj.data === 'object') {
            if (Array.isArray(obj.data.projects)) window.postMessage({ type: 'BK_PROJECTS_DATA', projects: obj.data.projects }, '*');
            if (Array.isArray(obj.data.devices)) window.postMessage({ type: 'BK_DEVICES_DATA', devices: obj.data.devices }, '*');
        }
    }

    // 1. JSON.parse
    const originalParse = JSON.parse;
    JSON.parse = function(text, reviver) {
        const result = originalParse(text, reviver);
        try { findAndSendData(result); } catch(e) {}
        return result;
    };

    // 2. Response.json()
    const originalJson = Response.prototype.json;
    Response.prototype.json = function() {
        return originalJson.apply(this, arguments).then(data => {
            try { findAndSendData(data); } catch(e) {}
            return data;
        });
    };

    // 3. XHR
    const originalXhrSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(...args) {
        this.addEventListener('load', function() {
            try {
                if (this.responseType === '' || this.responseType === 'text') {
                    const result = originalParse(this.responseText);
                    findAndSendData(result);
                }
            } catch(e) {}
        });
        return originalXhrSend.apply(this, args);
    };
})();
