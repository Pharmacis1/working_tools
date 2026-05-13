(function() {
    console.log("[BK Extension] Injector v8 (Diagnostic Mode) loaded");

    function findAndSendData(obj, visited, depth) {
        if (!visited) visited = new WeakSet();
        if (!depth) depth = 0;
        if (!obj || typeof obj !== 'object' || depth > 3) return;
        if (visited.has(obj)) return;
        visited.add(obj);

        if (Array.isArray(obj.projects)) {
            window.postMessage({ type: 'BK_PROJECTS_DATA', projects: obj.projects }, '*');
        }
        if (Array.isArray(obj.devices)) {
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

    // Перехват fetch()
    var originalFetch = window.fetch;
    window.fetch = function() {
        var args = arguments;
        var url = args[0];
        var options = args[1] || {};
        var method = (options.method || 'GET').toUpperCase();

        // Если это запрос на сохранение (PATCH/PUT/POST) - логируем его Payload
        if (['PATCH', 'PUT', 'POST'].includes(method)) {
            console.log(`%c[BK API Debug] ${method} Request to: ${url}`, "color: #d35400; font-weight: bold;");
            if (options.body) {
                try {
                    console.log("[BK API Payload]:", JSON.parse(options.body));
                } catch(e) {
                    console.log("[BK API Payload (Raw)]:", options.body);
                }
            }
        }

        return originalFetch.apply(this, arguments).then(function(response) {
            try {
                var clone = response.clone();
                clone.json().then(function(data) {
                    findAndSendData(data);
                }).catch(function() {});
            } catch(e) {}
            return response;
        });
    };

    // Перехват JSON.parse
    var originalParse = JSON.parse;
    JSON.parse = function(text, reviver) {
        var result = originalParse(text, reviver);
        try { findAndSendData(result); } catch(e) {}
        return result;
    };
})();
