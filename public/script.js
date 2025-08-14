async function baixarImagem() {
  const urlInput = document.getElementById('instaUrl');
  const url = urlInput.value;
  if (!url || !url.includes('instagram.com')) {
    alert('Por favor, insira um link válido do Instagram.');
    return;
  }

  const resultado = document.getElementById('resultado');
  const loader = document.getElementById('loader');

  // Reset UI and show loader
  resultado.innerHTML = '';
  loader.style.display = 'block';

  try {
    // Call the new backend endpoint
    const response = await fetch('/getMedia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Não foi possível buscar a mídia.');
    }

    const { media } = await response.json();

    if (!media || media.length === 0) {
        throw new Error('Nenhuma mídia foi encontrada neste post.');
    }

    // Build the gallery from the media array
    media.forEach(item => {
      const mediaItemDiv = document.createElement('div');
      mediaItemDiv.className = 'media-item';

      if (item.type === 'image') {
        const img = document.createElement('img');
        img.src = item.url;
        img.alt = 'Imagem do Instagram';
        mediaItemDiv.appendChild(img);
      } else if (item.type === 'video') {
        const video = document.createElement('video');
        video.src = item.url;
        video.setAttribute('playsinline', ''); // Good for mobile
        video.setAttribute('loop', '');
        // Mouse hover to play/pause
        video.addEventListener('mouseover', () => video.play());
        video.addEventListener('mouseout', () => video.pause());
        mediaItemDiv.appendChild(video);
      }

      const downloadLink = document.createElement('a');
      downloadLink.href = item.url;
      downloadLink.className = 'download-link';
      downloadLink.innerHTML = '<span>Baixar</span>'; // Use span for easier styling if needed
      downloadLink.target = '_blank'; // Open in new tab

      // To suggest a filename, we can try to extract it from the URL
      const urlParts = item.url.split('?')[0].split('/');
      downloadLink.download = urlParts[urlParts.length - 1];

      mediaItemDiv.appendChild(downloadLink);
      resultado.appendChild(mediaItemDiv);
    });

  } catch (error) {
    console.error(error);
    alert(`Erro: ${error.message}`);
  } finally {
    // Hide loader regardless of the outcome
    loader.style.display = 'none';
  }
}
