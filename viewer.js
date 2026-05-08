// Получаем URL картинки из адресной строки вкладки
const urlParams = new URLSearchParams(window.location.search);
const imgUrl = urlParams.get('url');

if (imgUrl) {
  // Запрашиваем файл напрямую с сервера, 
  // 'include' гарантирует, что мы используем куки (авторизацию) пользователя на сайте
  fetch(imgUrl, { credentials: 'include' })
    .then(response => {
      if (!response.ok) throw new Error('Network response was not ok');
      return response.blob();
    })
    .then(blob => {
      // Превращаем скачанные байты в картинку
      const objectUrl = URL.createObjectURL(blob);
      const img = document.getElementById('img');
      img.src = objectUrl;
      
      // Показываем картинку и прячем надпись "Загрузка..."
      img.onload = () => {
        img.style.display = 'block';
        document.getElementById('loading').style.display = 'none';
      };
    })
    .catch(error => {
      console.error('Ошибка загрузки картинки:', error);
      document.getElementById('loading').innerText = 'Ошибка при загрузке картинки. Возможно, сессия истекла.';
    });
} else {
  document.getElementById('loading').innerText = 'URL картинки не найден.';
}
