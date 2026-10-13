// ===========================
// ACOMPANHAR OBRA - REFATORADO
// ===========================

// --- ESTADO ---
let obrasCache = null;

// --- ELEMENTOS ---
const formAcompanhar = document.getElementById('formAcompanhar');
const msgErro = document.getElementById('msgErro');
const resultado = document.getElementById('resultadoObra');

// --- CARREGAMENTO DE DADOS ---
async function carregarObras() {
  if (obrasCache) return obrasCache;

  const resposta = await fetch('data/obras.json');

  if (!resposta.ok) {
    throw new Error('Falha ao carregar obras.json');
  }

  obrasCache = await resposta.json();
  return obrasCache;
}

// --- VALIDAÇÃO ---
function validarCodigo(codigo) {
  if (!codigo) {
    return 'Digite um código de obra.';
  }
  return null;
}

// --- BUSCA ---
function buscarObra(obras, codigo) {
  return obras[codigo] || null;
}

// --- RENDERIZAÇÃO ---
function limparResultado() {
  msgErro.textContent = '';
  resultado.style.display = 'none';
}

function renderizarObra(obra) {
  document.getElementById('nomeObra').textContent = obra.nome;
  document.getElementById('enderecoObra').textContent = obra.endereco;
  document.getElementById('progressoPreenchido').style.width = obra.percentual + '%';
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
    li.className = etapa.concluida ? 'etapa concluida' : 'etapa pendente';
    lista.appendChild(li);
  });
}

function renderizarGaleria(fotos) {
  const galeria = document.getElementById('galeriaObra');
  galeria.innerHTML = '';

  fotos.forEach(foto => {
    const img = document.createElement('img');
    img.src = foto;
    img.alt = 'Foto da obra';
    img.loading = 'lazy';
    galeria.appendChild(img);
  });
}

// --- MENSAGENS ---
function mostrarErro(mensagem) {
  msgErro.textContent = mensagem;
  resultado.style.display = 'none';
}

// --- HANDLER PRINCIPAL ---
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

// --- INICIALIZAÇÃO ---
if (formAcompanhar) {
  formAcompanhar.addEventListener('submit', handleSubmit);
}
