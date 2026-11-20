import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// CONFIGURAÇÃO DO SUPABASE
const SUPABASE_URL = 'https://sbynpvhsbnzqicgutsaw.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_xVkg_aTYnEvHZOzqNhg38A_0aTD6Kgs'; 

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===========================
// ACOMPANHAR OBRA
// ===========================

const formAcompanhar = document.getElementById('formAcompanhar');
const msgErro = document.getElementById('msgErro');
const resultado = document.getElementById('resultadoObra');

// URL do seu Google Apps Script
const URL_PLANILHA = "https://script.google.com/macros/s/AKfycbxRZAkglhLG3opeL920aFci-vzPtB1Un9I5AVkj4E4S6v1amuaPo2WSy9pfuXIRC98d/exec";

async function carregarObras(codigo) {
  try {
    const resposta = await fetch(`${URL_PLANILHA}?codigo=${codigo}`);
    if (!resposta.ok) throw new Error('Erro ao buscar dados no Google.');
    return await resposta.json();
  } catch (erro) {
    console.error("Erro na API do Google:", erro);
    return null;
  }
}

// NOVA FUNÇÃO: Busca as fotos e vídeos no Supabase
async function buscarMidiasSupabase(codigo) {
  const { data, error } = await supabase
    .from('midias')
    .select('url, tipo, legenda')
    .eq('obra_codigo', codigo)
    .eq('destino', 'obra')
    .order('data_envio', { ascending: false });

  if (error) {
    console.error("Erro ao buscar fotos no Supabase:", error);
    return [];
  }
  return data;
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

async function renderizarObra(obra, codigo) {
  document.getElementById('nomeObra').textContent = obra.nome;
  document.getElementById('enderecoObra').textContent = obra.endereco;
  
  setTimeout(() => {
    document.getElementById('progressoPreenchido').style.width = obra.percentual + '%';
  }, 100);
  
  document.getElementById('percentualObra').textContent = obra.percentual + '% concluído';

  renderizarEtapas(obra.etapas);
  
  // Força a busca no Supabase
  console.log("Buscando fotos no Supabase para o código:", codigo);
  const midiasSupabase = await buscarMidiasSupabase(codigo);
  console.log("Fotos encontradas no Supabase:", midiasSupabase);
  
  // Renderiza apenas o que veio do Supabase
  renderizarGaleria(midiasSupabase);

  resultado.style.display = 'block';
}

function renderizarEtapas(etapas) {
  const lista = document.getElementById('listaEtapas');
  lista.innerHTML = '';

  etapas.forEach(etapa => {
    const li = document.createElement('li');
    li.textContent = etapa.nome;
    
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

// Adaptada para aceitar fotos e vídeos do Supabase
function renderizarGaleria(midias) {
  const galeria = document.getElementById('galeriaObra');
  galeria.innerHTML = '';

  if (midias && midias.length > 0) {
    midias.forEach(midia => {
      if (midia.tipo === 'foto') {
        const img = document.createElement('img');
        img.src = midia.url;
        img.alt = midia.legenda || 'Foto da obra';
        img.loading = 'lazy';
        img.style.width = '100%';
        img.style.borderRadius = '8px';
        img.style.marginBottom = '10px';
        galeria.appendChild(img);
      } else {
        const video = document.createElement('video');
        video.src = midia.url;
        video.controls = true;
        video.style.width = '100%';
        video.style.borderRadius = '8px';
        video.style.marginBottom = '10px';
        galeria.appendChild(video);
      }
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
    const obras = await carregarObras(codigo);
    const obra = buscarObra(obras, codigo);

    if (!obra) {
      mostrarErro('Código não encontrado. Verifique com a construtora.');
      return;
    }

    await renderizarObra(obra, codigo);
  } catch (erro) {
    console.error('Erro ao carregar obras:', erro);
    mostrarErro('Erro ao carregar os dados. Tente novamente.');
  }
}

if (formAcompanhar) {
  formAcompanhar.addEventListener('submit', handleSubmit);
}
