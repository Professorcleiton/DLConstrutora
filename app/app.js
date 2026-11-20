import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ===========================
// CONFIGURAÇÃO DO SUPABASE
// ===========================
const SUPABASE_URL = 'https://sbynpvhsbnzqicgutsaw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xVkg_aTYnEvHZOzqNhg38A_0aTD6Kgs';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ETAPAS_PADRAO = ['Documentação Inicial', 'Fundação', 'Estrutura', 'Alvenaria', 'Cobertura', 'Acabamento', 'Entrega'];
const NOVA_OBRA = '__nova__';

const $ = (id) => document.getElementById(id);
let obras = [];

function mostrarStatus(el, texto, tipo = 'info') {
  el.textContent = texto;
  el.className = 'status ' + tipo;
}

// ===========================
// LOGIN / SESSÃO
// ===========================
supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) entrarNoApp(session.user);
});

$('formLogin').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  const erro = $('erro-login');
  btn.disabled = true;
  btn.textContent = 'Entrando...';
  erro.textContent = '';

  const { data, error } = await supabase.auth.signInWithPassword({
    email: $('email').value.trim(),
    password: $('senha').value,
  });

  btn.disabled = false;
  btn.textContent = 'Entrar';
  if (error) {
    erro.textContent = error.message === 'Invalid login credentials'
      ? 'E-mail ou senha incorretos.'
      : 'Erro: ' + error.message;
    return;
  }
  entrarNoApp(data.user);
});

$('btnSair').addEventListener('click', async () => {
  await supabase.auth.signOut();
  location.reload();
});

async function entrarNoApp(user) {
  $('tela-login').classList.add('hidden');
  $('tela-app').classList.remove('hidden');
  $('usuarioLogado').textContent = user?.email || '';
  await carregarObras();
}

// ===========================
// ABAS
// ===========================
document.querySelectorAll('.abas button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.abas button').forEach((b) => b.classList.toggle('ativa', b === btn));
    ['aba-envio', 'aba-obras'].forEach((id) => $(id).classList.toggle('hidden', id !== btn.dataset.aba));
  });
});

// ===========================
// LISTA DE OBRAS
// ===========================
async function carregarObras(selecionar) {
  const { data, error } = await supabase.from('obras').select('codigo, nome').order('codigo');
  if (error) {
    mostrarStatus($('statusEnvio'), '❌ Erro ao carregar obras: ' + error.message, 'erro');
    return;
  }
  obras = data;

  const opcoes = obras.map((o) => {
    const opt = document.createElement('option');
    opt.value = o.codigo;
    opt.textContent = `${o.codigo} – ${o.nome}`;
    return opt;
  });

  const envio = $('obraEnvio');
  const anteriorEnvio = envio.value;
  envio.replaceChildren(...opcoes.map((o) => o.cloneNode(true)));
  if (obras.length === 0) envio.innerHTML = '<option value="">Nenhuma obra cadastrada</option>';
  if (anteriorEnvio && obras.some((o) => o.codigo === anteriorEnvio)) envio.value = anteriorEnvio;

  const editar = $('obraEditar');
  const nova = document.createElement('option');
  nova.value = NOVA_OBRA;
  nova.textContent = '+ Cadastrar nova obra';
  editar.replaceChildren(...opcoes, nova);
  editar.value = selecionar || (obras[0]?.codigo ?? NOVA_OBRA);
  await abrirObra(editar.value);
}

// ===========================
// ENVIAR MÍDIA
// ===========================
$('arquivo').addEventListener('change', () => {
  const arquivo = $('arquivo').files[0];
  const preview = $('preview');
  preview.innerHTML = '';
  if (!arquivo) return;
  const el = document.createElement(arquivo.type.startsWith('video') ? 'video' : 'img');
  el.src = URL.createObjectURL(arquivo);
  if (el.tagName === 'VIDEO') el.controls = true;
  preview.appendChild(el);
});

function nomeSeguro(nome) {
  return nome
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // tira acentos
    .replace(/[^\w.-]+/g, '_');
}

document.querySelectorAll('.destino-botoes button').forEach((btn) => {
  btn.addEventListener('click', () => enviar(btn.dataset.destino));
});

async function enviar(destino) {
  const status = $('statusEnvio');
  const botoes = document.querySelectorAll('.destino-botoes button');
  const codigo = $('obraEnvio').value;
  const arquivo = $('arquivo').files[0];

  if (!codigo || !arquivo) {
    mostrarStatus(status, 'Escolha a obra e selecione um arquivo.', 'erro');
    return;
  }

  mostrarStatus(status, 'Enviando... aguarde.');
  botoes.forEach((b) => (b.disabled = true));

  try {
    const caminho = `${Date.now()}-${nomeSeguro(arquivo.name)}`;
    const { error: erroUpload } = await supabase.storage
      .from('midias')
      .upload(caminho, arquivo, { contentType: arquivo.type, cacheControl: '31536000' });
    if (erroUpload) throw new Error('Erro no upload: ' + erroUpload.message);

    const { data: urlData } = supabase.storage.from('midias').getPublicUrl(caminho);

    const { error: erroInsert } = await supabase.from('midias').insert({
      obra_codigo: codigo,
      url: urlData.publicUrl,
      tipo: arquivo.type.startsWith('video') ? 'video' : 'foto',
      legenda: $('legenda').value.trim() || null,
      categoria: $('categoria').value || null,
      destino,
    });
    if (erroInsert) throw new Error('Erro ao salvar no banco: ' + erroInsert.message);

    mostrarStatus(status, destino === 'obra'
      ? `✅ Publicado em Acompanhar Obra (${codigo})!`
      : '✅ Enviado para Redes Sociais!', 'ok');

    $('arquivo').value = '';
    $('legenda').value = '';
    $('categoria').value = '';
    $('preview').innerHTML = '';
  } catch (erro) {
    mostrarStatus(status, '❌ ' + erro.message, 'erro');
  } finally {
    botoes.forEach((b) => (b.disabled = false));
  }
}

// ===========================
// GERENCIAR OBRAS
// ===========================
$('obraEditar').addEventListener('change', (e) => abrirObra(e.target.value));

// Percentual: barra e número sempre iguais
$('obraPercentualRange').addEventListener('input', (e) => ($('obraPercentualNum').value = e.target.value));
$('obraPercentualNum').addEventListener('input', (e) => ($('obraPercentualRange').value = e.target.value));

function definirPercentual(valor) {
  $('obraPercentualRange').value = valor;
  $('obraPercentualNum').value = valor;
}

function linhaEtapa(nome = '', status = 'pendente') {
  const linha = document.createElement('div');
  linha.className = 'etapa-linha';
  linha.innerHTML = `
    <input type="text" class="etapa-nome" placeholder="Nome da etapa" required>
    <select class="etapa-status">
      <option value="pendente">⏳ Pendente</option>
      <option value="andamento">🔨 Em andamento</option>
      <option value="concluida">✅ Concluída</option>
    </select>
    <button type="button" title="Subir">↑</button>
    <button type="button" title="Remover">✕</button>`;
  linha.querySelector('.etapa-nome').value = nome;
  linha.querySelector('.etapa-status').value = status;
  const [btnSubir, btnRemover] = linha.querySelectorAll('button');
  btnSubir.addEventListener('click', () => {
    if (linha.previousElementSibling) linha.parentNode.insertBefore(linha, linha.previousElementSibling);
  });
  btnRemover.addEventListener('click', () => linha.remove());
  return linha;
}

$('btnAddEtapa').addEventListener('click', () => $('listaEtapas').appendChild(linhaEtapa()));

async function abrirObra(codigo) {
  const status = $('statusObra');
  status.textContent = '';
  const nova = codigo === NOVA_OBRA;
  $('campoCodigo').classList.toggle('hidden', !nova);
  $('obraCodigo').required = nova;
  $('linkSite').classList.toggle('hidden', nova);

  if (nova) {
    $('obraCodigo').value = '';
    $('obraNome').value = '';
    $('obraEndereco').value = '';
    definirPercentual(0);
    $('listaEtapas').replaceChildren(...ETAPAS_PADRAO.map((n) => linhaEtapa(n)));
    return;
  }

  $('linkSite').href = `../acompanhar.html?codigo=${encodeURIComponent(codigo)}`;

  const [{ data: obra, error: e1 }, { data: etapas, error: e2 }] = await Promise.all([
    supabase.from('obras').select('*').eq('codigo', codigo).single(),
    supabase.from('etapas').select('nome, status').eq('obra_codigo', codigo).order('ordem').order('id'),
  ]);
  if (e1 || e2) {
    mostrarStatus(status, '❌ Erro ao abrir obra: ' + (e1 || e2).message, 'erro');
    return;
  }

  $('obraNome').value = obra.nome;
  $('obraEndereco').value = obra.endereco || '';
  definirPercentual(obra.percentual);
  $('listaEtapas').replaceChildren(...etapas.map((e) => linhaEtapa(e.nome, e.status)));
}

$('formObra').addEventListener('submit', async (e) => {
  e.preventDefault();
  const status = $('statusObra');
  const btn = e.target.querySelector('button[type=submit]');
  const nova = $('obraEditar').value === NOVA_OBRA;
  const codigo = nova ? $('obraCodigo').value.trim().toUpperCase() : $('obraEditar').value;

  if (nova && obras.some((o) => o.codigo === codigo)) {
    mostrarStatus(status, '❌ Já existe uma obra com esse código.', 'erro');
    return;
  }

  const percentual = Math.min(100, Math.max(0, parseInt($('obraPercentualNum').value, 10) || 0));
  const etapas = [...document.querySelectorAll('#listaEtapas .etapa-linha')]
    .map((linha, i) => ({
      obra_codigo: codigo,
      ordem: i + 1,
      nome: linha.querySelector('.etapa-nome').value.trim(),
      status: linha.querySelector('.etapa-status').value,
    }))
    .filter((et) => et.nome);

  btn.disabled = true;
  mostrarStatus(status, 'Salvando...');

  try {
    const { error: erroObra } = await supabase.from('obras').upsert({
      codigo,
      nome: $('obraNome').value.trim(),
      endereco: $('obraEndereco').value.trim() || null,
      percentual,
    });
    if (erroObra) throw erroObra;

    // Regrava as etapas na ordem da tela
    const { error: erroDel } = await supabase.from('etapas').delete().eq('obra_codigo', codigo);
    if (erroDel) throw erroDel;
    if (etapas.length) {
      const { error: erroIns } = await supabase.from('etapas').insert(etapas);
      if (erroIns) throw erroIns;
    }

    await carregarObras(codigo);
    mostrarStatus(status, `✅ Obra ${codigo} salva!`, 'ok');
  } catch (erro) {
    mostrarStatus(status, '❌ Erro ao salvar: ' + erro.message, 'erro');
  } finally {
    btn.disabled = false;
  }
});
