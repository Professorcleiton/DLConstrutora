import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'COLE_AQUI_SUA_PROJECT_URL';
const SUPABASE_ANON_KEY = 'COLE_AQUI_SUA_ANON_KEY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Verifica se já está logado
supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) mostrarEnvio();
});

async function fazerLogin() {
  const email = document.getElementById('email').value;
  const senha = document.getElementById('senha').value;
  
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  
  if (error) {
    document.getElementById('erro-login').textContent = 'Erro: ' + error.message;
  } else {
    mostrarEnvio();
  }
}

async function mostrarEnvio() {
  document.getElementById('tela-login').classList.add('hidden');
  document.getElementById('tela-envio').classList.remove('hidden');
  
  // Carrega obras
  const { data: obras } = await supabase.from('obras').select('id, nome');
  const select = document.getElementById('obra-select');
  select.innerHTML = obras.map(o => `<option value="${o.id}">${o.nome}</option>`).join('');
}

async function enviar(destino) {
  const status = document.getElementById('status');
  const arquivo = document.getElementById('arquivo').files[0];
  const obraId = document.getElementById('obra-select').value;
  const legenda = document.getElementById('legenda').value;
  const categoria = document.getElementById('categoria').value;

  if (!arquivo) {
    status.textContent = 'Selecione uma foto ou vídeo primeiro.';
    return;
  }

  status.textContent = 'Enviando...';

  // 1. Upload do arquivo para o Storage
  const nomeArquivo = `${Date.now()}-${arquivo.name}`;
  const { error: erroUpload } = await supabase.storage
    .from('midias')
    .upload(nomeArquivo, arquivo);

  if (erroUpload) {
    status.textContent = 'Erro no upload: ' + erroUpload.message;
    return;
  }

  // 2. Pega a URL pública do arquivo
  const { data: urlData } = supabase.storage.from('midias').getPublicUrl(nomeArquivo);

  // 3. Detecta o tipo
  const tipo = arquivo.type.startsWith('video') ? 'video' : 'foto';

  // 4. Insere no banco
  const { error: erroInsert } = await supabase.from('midias').insert({
    obra_id: obraId,
    url: urlData.publicUrl,
    tipo: tipo,
    legenda: legenda || null,
    categoria: categoria || null,
    destino: destino
  });

  if (erroInsert) {
    status.textContent = 'Erro ao salvar: ' + erroInsert.message;
  } else {
    status.textContent = destino === 'obra' 
      ? '✅ Publicado na página Acompanhar Obra!' 
      : '✅ Enviado para redes sociais!';
    document.getElementById('arquivo').value = '';
    document.getElementById('legenda').value = '';
  }
}

async function sair() {
  await supabase.auth.signOut();
  location.reload();
}

// Expõe funções para os botões HTML
window.fazerLogin = fazerLogin;
window.enviar = enviar;
window.sair = sair;
