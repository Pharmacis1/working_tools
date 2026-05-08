chrome.downloads.onCreated.addListener((downloadItem) => {
  const url = downloadItem.url || '';
  
  // Проверяем расширение прямо в URL (так как filename на этом этапе еще может быть пуст)
  const isImage = url.match(/\.(jpg|jpeg|png|webp|gif|bmp)(?:\?|#|$)/i);

  if (isImage) {
    const referrer = downloadItem.referrer || '';
    
    // Сначала проверяем синхронно, если повезло и referrer есть
    if (referrer.includes('sd.burgerkingrus.ru') || url.includes('sd.burgerkingrus.ru')) {
      chrome.downloads.cancel(downloadItem.id);
      chrome.tabs.create({
        url: chrome.runtime.getURL(`viewer.html?url=${encodeURIComponent(url)}`)
      });
    } else {
      // Иначе проверяем асинхронно, есть ли открытая вкладка SD (работает для картинок со сторонних серверов без referrer)
      chrome.tabs.query({ url: "*://sd.burgerkingrus.ru/*" }, (tabs) => {
        const isServiceDeskOpen = tabs && tabs.length > 0;
        
        if (isServiceDeskOpen) {
          chrome.downloads.cancel(downloadItem.id);
          chrome.tabs.create({
            url: chrome.runtime.getURL(`viewer.html?url=${encodeURIComponent(url)}`)
          });
        }
      });
    }
  }
});
