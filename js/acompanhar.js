// ===========================
// ACOMPANHAR OBRA
// ===========================

let obrasCache = null;

const formAcompanhar = document.getElementById('formAcompanhar');
const msgErro = document.getElementById('msgErro');
const resultado = document.getElementById('resultadoObra');

async function carregarObras() {
  if (obrasCache) return obrasCache;

  // O timestamp garante que o navegador não use uma versão antiga do JSON em cache
  const resposta = await fetch('data/obras.json?v=' + new Date().getTime());

  if (!resposta.ok) {
    throw new Error('Falha ao carregar obras.json');
  }

  obrasCache = await resposta.json();
  return obrasCache;
}

function validarCodigo(codigo) {
  if (!codigo) {
    return 'Digite um código de obra.';
  }
  return null;
}

function buscarObra(obras, codigo) {
  return obras[codigo] || null;
}

function limparResultado() {
  msgErro.textContent = '';
  resultado.style.display = 'none';
}

function renderizarObra(obra) {
  document.getElementById('nomeObra').textContent = obra.nome;
  document.getElementById('enderecoObra').textContent = obra.endereco;
  
  // Animação da barra de progresso
  setTimeout(() => {
    document.getElementById('progressoPreenchido').style.width = obra.percentual + '%';
  }, 100);
  
  document.getElementById('percentualObra').textContent = obra.percentual + '% concluído';

  renderizarEtapas(obra.etapas);
  renderizarGaleria(obra.fotos);

  resultado.style.display = 'block';
}

function renderizarEtapas(etapas) {
  const lista = document.getElementById('listaEtapas');
  lista.innerHTML = '';

  etapas.forEach(etapa => {
    const li = document.createElement('li');
    li.textContent = etapa.nome;
    
    // Lógica para os 3 status
    if (etapa.status === 'concluida') {
      li.className = 'etapa concluida';
    } else if (etapa.status === 'andamento') {
      li.className = 'etapa andamento';
    } else {
      li.className = 'etapa pendente';
    }
    
    lista.appendChild(li);
  });
}

function renderizarGaleria(fotos) {
  const galeria = document.getElementById('galeriaObra');
  galeria.innerHTML = '';

  if (fotos && fotos.length > 0) {
    fotos.forEach(foto => {
      const img = document.createElement('img');
      img.src = foto;
      img.alt = 'Foto da obra';
      img.loading = 'lazy';
      galeria.appendChild(img);
    });
  } else {
    galeria.innerHTML = '<p style="color: #888; font-size: 0.9rem;">Nenhuma foto adicionada ainda.</p>';
  }
}

function mostrarErro(mensagem) {
  msgErro.textContent = mensagem;
  resultado.style.display = 'none';
}

async function handleSubmit(e) {
  e.preventDefault();
  limparResultado();

  const codigo = document.getElementById('codigoObra').value.trim().toUpperCase();

  const erroValidacao = validarCodigo(codigo);
  if (erroValidacao) {
    mostrarErro(erroValidacao);
    return;
  }

  try {
    const obras = await carregarObras();
    const obra = buscarObra(obras, codigo);

    if (!obra) {
      mostrarErro('Código não encontrado. Verifique com a construtora.');
      return;
    }

    renderizarObra(obra);
  } catch (erro) {
    console.error('Erro ao carregar obras:', erro);
    mostrarErro('Erro ao carregar os dados. Tente novamente.');
  }
}

if (formAcompanhar) {
  formAcompanhar.addEventListener('submit', handleSubmit);
}
