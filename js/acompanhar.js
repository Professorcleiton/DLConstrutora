// ===========================
// ACOMPANHAR OBRA
// ===========================

const formAcompanhar = document.getElementById('formAcompanhar');
const msgErro = document.getElementById('msgErro');
const resultado = document.getElementById('resultadoObra');

let obrasCache = null;

// Carrega o JSON uma vez e guarda em cache
async function carregarObras() {
  if (obrasCache) return obrasCache;

  try {
    const resposta = await fetch('data/obras.json');

    if (!resposta.ok) {
      throw new Error('Não foi possível carregar o arquivo de obras.');
    }

    obrasCache = await resposta.json();
    return obrasCache;
  } catch (erro) {
    console.error('Erro ao carregar obras.json:', erro);
    throw erro;
  }
}

if (formAcompanhar) {
  formAcompanhar.addEventListener('submit', async (e) => {
    e.preventDefault();

    const codigo = document.getElementById('codigoObra').value.trim().toUpperCase();

    // Limpa mensagens anteriores
    msgErro.textContent = '';
    resultado.style.display = 'none';

    if (!codigo) {
      msgErro.textContent = 'Digite um código de obra.';
      return;
    }

    try {
      const obras = await carregarObras();

      // Verifica se o código existe
      if (!obras[codigo]) {
        msgErro.textContent = 'Código não encontrado. Verifique com a construtora.';
        return;
      }

      const obra = obras[codigo];

      // Preenche os dados principais
      document.getElementById('nomeObra').textContent = obra.nome;
      document.getElementById('enderecoObra').textContent = obra.endereco;
      document.getElementById('progressoPreenchido').style.width = obra.percentual + '%';
      document.getElementById('percentualObra').textContent = obra.percentual + '% concluído';

      // Preenche as etapas
      const lista = document.getElementById('listaEtapas');
      lista.innerHTML = '';
      obra.etapas.forEach(etapa => {
        const li = document.createElement('li');
        li.textContent = etapa.nome;
        li.className = etapa.concluida ? 'etapa concluida' : 'etapa pendente';
        lista.appendChild(li);
      });

      // Preenche a galeria de fotos
      const galeria = document.getElementById('galeriaObra');
      galeria.innerHTML = '';
      obra.fotos.forEach(foto => {
        const img = document.createElement('img');
        img.src = foto;
        img.alt = 'Foto da obra ' + obra.nome;
        img.loading = 'lazy';
        galeria.appendChild(img);
      });

      resultado.style.display = 'block';

    } catch (erro) {
      msgErro.textContent = 'Erro ao carregar os dados. Verifique sua conexão e tente novamente.';
    }
  });
}
