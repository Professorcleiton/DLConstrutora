const form = document.getElementById('formAcompanhar');
const msgErro = document.getElementById('msgErro');
const resultado = document.getElementById('resultadoObra');

let obrasCache = null;

// Carrega o JSON uma vez
async function carregarObras() {
  if (obrasCache) return obrasCache;
  const resposta = await fetch('data/obras.json');
  obrasCache = await resposta.json();
  return obrasCache;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const codigo = document.getElementById('codigoObra').value.trim().toUpperCase();

  const obras = await carregarObras();

  if (!obras[codigo]) {
    msgErro.textContent = 'Código não encontrado. Verifique com a construtora.';
    resultado.style.display = 'none';
    return;
  }

  msgErro.textContent = '';
  const obra = obras[codigo];

  document.getElementById('nomeObra').textContent = obra.nome;
  document.getElementById('enderecoObra').textContent = obra.endereco;
  document.getElementById('progressoPreenchido').style.width = obra.percentual + '%';
  document.getElementById('percentualObra').textContent = obra.percentual + '% concluído';

  // Etapas
  const lista = document.getElementById('listaEtapas');
  lista.innerHTML = '';
  obra.etapas.forEach(etapa => {
    const li = document.createElement('li');
    li.textContent = etapa.nome;
    li.className = etapa.concluida ? 'etapa concluida' : 'etapa pendente';
    lista.appendChild(li);
  });

  // Fotos
  const galeria = document.getElementById('galeriaObra');
  galeria.innerHTML = '';
  obra.fotos.forEach(foto => {
    const img = document.createElement('img');
    img.src = foto;
    img.alt = 'Foto da obra';
    galeria.appendChild(img);
  });

  resultado.style.display = 'block';
});
