import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ===========================
// CONFIGURAÇÃO DO SUPABASE
// ===========================
const SUPABASE_URL = 'https://sbynpvhsbnzqicgutsaw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xVkg_aTYnEvHZOzqNhg38A_0aTD6Kgs';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===========================
// ACOMPANHAR OBRA
// ===========================
const formAcompanhar = document.getElementById('formAcompanhar');
const msgErro = document.getElementById('msgErro');
const resultado = document.getElementById('resultadoObra');

// Busca obra + etapas + mídias de uma vez (função buscar_obra no Supabase)
async function buscarObra(codigo) {
  const { data, error } = await supabase.rpc('buscar_obra', { p_codigo: codigo });
  if (error) throw error;
  return data; // null quando o código não existe
}

function limparResultado() {
  msgErro.textContent = '';
  resultado.style.display = 'none';
}

function mostrarErro(mensagem) {
  msgErro.textContent = mensagem;
  resultado.style.display = 'none';
}

function renderizarObra(obra) {
  document.getElementById('nomeObra').textContent = obra.nome;
  document.getElementById('enderecoObra').textContent = obra.endereco || '';

  const percentual = Number(obra.percentual) || 0;
  const barra = document.getElementById('progressoPreenchido');
  barra.style.width = '0%';
  setTimeout(() => { barra.style.width = percentual + '%'; }, 100);
  document.getElementById('percentualObra').textContent = percentual + '% concluído';

  renderizarEtapas(obra.etapas || []);
  renderizarGaleria(obra.midias || []);

  resultado.style.display = 'block';
}

function renderizarEtapas(etapas) {
  const lista = document.getElementById('listaEtapas');
  lista.innerHTML = '';

  etapas.forEach(etapa => {
    const li = document.createElement('li');
    li.textContent = etapa.nome;
    const status = ['concluida', 'andamento'].includes(etapa.status) ? etapa.status : 'pendente';
    li.className = 'etapa ' + status;
    lista.appendChild(li);
  });
}

function renderizarGaleria(midias) {
  const galeria = document.getElementById('galeriaObra');
  galeria.innerHTML = '';

  if (midias.length === 0) {
    galeria.innerHTML = '<p style="color: #888; font-size: 0.9rem;">Nenhuma foto adicionada ainda.</p>';
    return;
  }

  midias.forEach(midia => {
    const figura = document.createElement('figure');
    figura.style.margin = '0 0 16px';

    let el;
    if (midia.tipo === 'video') {
      el = document.createElement('video');
      el.controls = true;
      el.preload = 'metadata';
      el.playsInline = true;
    } else {
      el = document.createElement('img');
      el.alt = midia.legenda || 'Foto da obra';
      el.loading = 'lazy';
    }
    el.src = midia.url;
    el.style.width = '100%';
    el.style.borderRadius = '8px';
    el.style.display = 'block';
    figura.appendChild(el);

    if (midia.legenda) {
      const legenda = document.createElement('figcaption');
      legenda.textContent = midia.legenda;
      legenda.style.cssText = 'font-size: 0.9rem; color: #666; margin-top: 6px;';
      figura.appendChild(legenda);
    }

    galeria.appendChild(figura);
  });
}

async function handleSubmit(e) {
  e.preventDefault();
  limparResultado();

  const codigo = document.getElementById('codigoObra').value.trim().toUpperCase();
  if (!codigo) {
    mostrarErro('Digite um código de obra.');
    return;
  }

  const botao = formAcompanhar.querySelector('button[type="submit"]');
  botao.disabled = true;
  botao.textContent = 'Buscando...';

  try {
    const obra = await buscarObra(codigo);
    if (!obra) {
      mostrarErro('Código não encontrado. Verifique com a construtora.');
      return;
    }
    renderizarObra(obra);
  } catch (erro) {
    console.error('Erro ao buscar obra no Supabase:', erro);
    mostrarErro('Erro ao carregar os dados. Tente novamente.');
  } finally {
    botao.disabled = false;
    botao.textContent = 'Buscar obra';
  }
}

if (formAcompanhar) {
  formAcompanhar.addEventListener('submit', handleSubmit);

  // Permite abrir direto: acompanhar.html?codigo=CDO-2026-001
  const codigoUrl = new URLSearchParams(location.search).get('codigo');
  if (codigoUrl) {
    document.getElementById('codigoObra').value = codigoUrl;
    formAcompanhar.requestSubmit();
  }
}
