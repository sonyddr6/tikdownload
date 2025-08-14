async function baixarImagem() {
  const url = document.getElementById('instaUrl').value;
  if (!url) {
    alert('Insira um link válido do Instagram');
    return;
  }

  const resultado = document.getElementById('resultado');
  resultado.innerHTML = 'Buscando imagem...';

  try {
    const response = await fetch('/getImageUrl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Imagem não encontrada');
    }

    const { imageUrl } = await response.json();

    resultado.innerHTML = `
      <a href="${imageUrl}" target="_blank" download>Clique aqui para baixar a imagem em alta qualidade</a>
      <br><br>
      <img src="${imageUrl}" alt="Imagem do Instagram" style="max-width: 300px; margin-top: 10px;">
    `;
  } catch (error) {
    console.error(error);
    resultado.innerHTML = '';
    alert(`Erro: ${error.message}`);
  }
}
