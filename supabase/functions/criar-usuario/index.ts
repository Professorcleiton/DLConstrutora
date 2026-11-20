// =====================================================================
// DL Construtora – Edge Function "criar-usuario"
// Permite que a EQUIPE cadastre clientes (e colegas) direto pelo app.
//
// Como publicar (uma vez só):
//   Supabase > Edge Functions > Deploy a new function > Via Editor
//   Nome: criar-usuario  → cole este arquivo inteiro → Deploy function
//
// Ações (corpo JSON):
//   { acao: "criar", email, senha, nome, papel: "cliente"|"equipe", obra_codigo }
//   { acao: "senha", user_id, senha }     ← redefine a senha de alguém
// =====================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function responder(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    return await atender(req);
  } catch (erro) {
    console.error(erro);
    return responder({ erro: 'Erro inesperado: ' + (erro instanceof Error ? erro.message : String(erro)) }, 500);
  }
});

async function atender(req: Request): Promise<Response> {
  if (req.method !== 'POST') return responder({ erro: 'Use POST.' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const chaveServico = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, chaveServico, { auth: { persistSession: false } });

  // 1. Quem está chamando? Precisa estar logado e ser da EQUIPE.
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: quem, error: erroQuem } = await admin.auth.getUser(token);
  if (erroQuem || !quem?.user) return responder({ erro: 'Faça login de novo.' }, 401);

  const { data: perfilChamador } = await admin
    .from('perfis').select('papel').eq('user_id', quem.user.id).maybeSingle();
  if (perfilChamador?.papel !== 'equipe') {
    return responder({ erro: 'Apenas a equipe pode cadastrar usuários.' }, 403);
  }

  let corpo: Record<string, string>;
  try { corpo = await req.json(); } catch { return responder({ erro: 'Dados inválidos.' }, 400); }

  // 2a. Redefinir senha
  if (corpo.acao === 'senha') {
    if (!corpo.user_id || (corpo.senha || '').length < 6) {
      return responder({ erro: 'A senha precisa ter pelo menos 6 caracteres.' }, 400);
    }
    const { error } = await admin.auth.admin.updateUserById(corpo.user_id, { password: corpo.senha });
    if (error) return responder({ erro: error.message }, 400);
    return responder({ ok: true });
  }

  // 2b. Criar usuário
  const email = (corpo.email || '').trim().toLowerCase();
  const senha = corpo.senha || '';
  const nome = (corpo.nome || '').trim() || null;
  const papel = corpo.papel === 'equipe' ? 'equipe' : 'cliente';
  const obra = papel === 'cliente' ? (corpo.obra_codigo || '').trim().toUpperCase() : null;

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return responder({ erro: 'E-mail inválido.' }, 400);
  if (senha.length < 6) return responder({ erro: 'A senha precisa ter pelo menos 6 caracteres.' }, 400);
  if (papel === 'cliente' && !obra) return responder({ erro: 'Escolha a obra do cliente.' }, 400);

  if (obra) {
    const { data: existeObra } = await admin.from('obras').select('codigo').eq('codigo', obra).maybeSingle();
    if (!existeObra) return responder({ erro: `A obra ${obra} não existe.` }, 400);
  }

  const { data: criado, error: erroCriar } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome },
  });
  if (erroCriar || !criado?.user) {
    const jaExiste = /already|registered|exists/i.test(erroCriar?.message || '');
    return responder({
      erro: jaExiste
        ? 'Esse e-mail já tem cadastro. Use "Alterar" na lista para mudar o acesso dele.'
        : (erroCriar?.message || 'Não foi possível criar o usuário.'),
    }, 400);
  }

  const { error: erroPerfil } = await admin.from('perfis').upsert({
    user_id: criado.user.id,
    papel,
    obra_codigo: obra,
    nome,
  });
  if (erroPerfil) {
    await admin.auth.admin.deleteUser(criado.user.id); // desfaz para não ficar pela metade
    return responder({ erro: 'Erro ao salvar o perfil: ' + erroPerfil.message }, 400);
  }

  return responder({ ok: true, user_id: criado.user.id });
}
