(function() {
    console.log("[BK Extension] Injector v7 loaded");

    function findAndSendData(obj, visited, depth) {
        if (!visited) visited = new WeakSet();
        if (!depth) depth = 0;
        if (!obj || typeof obj !== 'object' || depth > 3) return;
        if (visited.has(obj)) return;
        visited.add(obj);

        if (Array.isArray(obj.projects)) {
            console.log("[BK Inject] Found projects:", obj.projects.length);
            window.postMessage({ type: 'BK_PROJECTS_DATA', projects: obj.projects }, '*');
        }
        if (Array.isArray(obj.devices)) {
            console.log("[BK Inject] Found devices:", obj.devices.length);
            window.postMessage({ type: 'BK_DEVICES_DATA', devices: obj.devices }, '*');
        }

        for (var key in obj) {
            try {
                var val = obj[key];
                if (val && typeof val === 'object' && key !== 'projects' && key !== 'devices') {
                    findAndSendData(val, visited, depth + 1);
                }
            } catch(e) {}
        }
    }

    // 1. Перехват fetch() — самый надёжный способ
    var originalFetch = window.fetch;
    window.fetch = function() {
        return originalFetch.apply(this, arguments).then(function(response) {
            // Читаем из КЛОНА, оригинал не трогаем
            try {
                var clone = response.clone();
                clone.json().then(function(data) {
                    try { findAndSendData(data); } catch(e) {}
                }).catch(function() {});
            } catch(e) {}
            return response;
        });
    };

    // 2. Перехват JSON.parse (ловит данные из XHR и других источников)
    var originalParse = JSON.parse;
    JSON.parse = function(text, reviver) {
        var result = originalParse(text, reviver);
        try { findAndSendData(result); } catch(e) {}
        return result;
    };
})();
