-- =====================================================================
-- DL Construtora – Parte 2: EQUIPE x CLIENTE, apagar e mover mídias
-- Rode DEPOIS do schema.sql. Cole TUDO no SQL Editor > Run.
-- Pode rodar mais de uma vez sem problema.
--
-- Papéis:
--   equipe  → vê e edita todas as obras, envia para obra/redes,
--             apaga e move qualquer mídia, libera acessos.
--   cliente → vê só a obra dele, envia fotos só para ela,
--             apaga só o que ele mesmo enviou.
--   (sem papel) → entra no app, mas não vê nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABELA DE PERFIS (quem é equipe e quem é cliente de qual obra)
-- ---------------------------------------------------------------------
create table if not exists public.perfis (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  papel       text not null check (papel in ('equipe', 'cliente')),
  obra_codigo text references public.obras(codigo) on update cascade on delete set null,
  criado_em   timestamptz not null default now(),
  check (papel = 'equipe' or obra_codigo is not null)
);
alter table public.perfis enable row level security;

-- Todos os usuários que JÁ existem viram EQUIPE (para ninguém perder acesso).
-- Se algum deles for cliente, troque depois no app, na aba "Acessos".
insert into public.perfis (user_id, papel)
select id, 'equipe' from auth.users
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------
-- 2. FUNÇÕES AUXILIARES
-- ---------------------------------------------------------------------
create or replace function public.eh_equipe()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where user_id = auth.uid() and papel = 'equipe');
$$;

create or replace function public.minha_obra()
returns text language sql stable security definer set search_path = public as $$
  select obra_codigo from perfis where user_id = auth.uid() and papel = 'cliente';
$$;

-- O app chama para saber quem está logado
create or replace function public.meu_perfil()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('papel', papel, 'obra_codigo', obra_codigo)
  from perfis where user_id = auth.uid();
$$;

-- Lista os acessos (só equipe)
create or replace function public.listar_acessos()
returns table (user_id uuid, email text, papel text, obra_codigo text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not eh_equipe() then raise exception 'Apenas a equipe pode ver os acessos.'; end if;
  return query
    select u.id, u.email::text, p.papel, p.obra_codigo
    from auth.users u
    left join perfis p on p.user_id = u.id
    order by p.papel nulls first, u.email;
end $$;

-- Define o acesso de um usuário pelo e-mail (só equipe)
create or replace function public.definir_acesso(p_email text, p_papel text, p_obra text default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not eh_equipe() then raise exception 'Apenas a equipe pode liberar acessos.'; end if;
  if p_papel not in ('equipe', 'cliente') then raise exception 'Papel inválido.'; end if;
  if p_papel = 'cliente' and coalesce(trim(p_obra), '') = '' then
    raise exception 'Escolha a obra do cliente.';
  end if;

  select id into v_id from auth.users where lower(email) = lower(trim(p_email));
  if v_id is null then
    raise exception 'Usuário % não existe. Crie primeiro no Supabase: Authentication > Users > Add user.', p_email;
  end if;
  if v_id = auth.uid() and p_papel <> 'equipe' then
    raise exception 'Você não pode tirar o seu próprio acesso de equipe.';
  end if;

  insert into perfis (user_id, papel, obra_codigo)
  values (v_id, p_papel, case when p_papel = 'cliente' then upper(trim(p_obra)) end)
  on conflict (user_id) do update
    set papel = excluded.papel, obra_codigo = excluded.obra_codigo;
  return 'ok';
end $$;

-- Remove o acesso (o login continua existindo, mas não vê nada)
create or replace function public.remover_acesso(p_user_id uuid)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not eh_equipe() then raise exception 'Apenas a equipe pode remover acessos.'; end if;
  if p_user_id = auth.uid() then raise exception 'Você não pode remover o seu próprio acesso.'; end if;
  delete from perfis where user_id = p_user_id;
  return 'ok';
end $$;

revoke all on function public.eh_equipe(), public.minha_obra(), public.meu_perfil(),
  public.listar_acessos(), public.definir_acesso(text, text, text), public.remover_acesso(uuid) from public, anon;
grant execute on function public.eh_equipe(), public.minha_obra(), public.meu_perfil(),
  public.listar_acessos(), public.definir_acesso(text, text, text), public.remover_acesso(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3. PERMISSÕES BÁSICAS (o RLS abaixo é que decide o que cada um vê)
-- ---------------------------------------------------------------------
grant select on public.perfis to authenticated;
grant select, insert, update, delete on public.obras, public.etapas, public.midias to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ---------------------------------------------------------------------
-- 4. REGRAS (RLS) – apaga as antigas e cria as novas
-- ---------------------------------------------------------------------
do $$
declare p record;
begin
  for p in
    select tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('obras', 'etapas', 'midias', 'perfis')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- PERFIS: cada um vê o seu; equipe vê todos. Alterações só pelas funções.
create policy "ver perfil" on public.perfis for select to authenticated
  using (user_id = auth.uid() or eh_equipe());

-- OBRAS
create policy "ver obras" on public.obras for select to authenticated
  using (eh_equipe() or codigo = minha_obra());
create policy "equipe cria obras" on public.obras for insert to authenticated
  with check (eh_equipe());
create policy "equipe altera obras" on public.obras for update to authenticated
  using (eh_equipe()) with check (eh_equipe());
create policy "equipe apaga obras" on public.obras for delete to authenticated
  using (eh_equipe());

-- ETAPAS
create policy "ver etapas" on public.etapas for select to authenticated
  using (eh_equipe() or obra_codigo = minha_obra());
create policy "equipe cria etapas" on public.etapas for insert to authenticated
  with check (eh_equipe());
create policy "equipe altera etapas" on public.etapas for update to authenticated
  using (eh_equipe()) with check (eh_equipe());
create policy "equipe apaga etapas" on public.etapas for delete to authenticated
  using (eh_equipe());

-- MÍDIAS
create policy "ver midias" on public.midias for select to authenticated
  using (eh_equipe() or obra_codigo = minha_obra());
create policy "enviar midias" on public.midias for insert to authenticated
  with check (
    eh_equipe()
    or (obra_codigo = minha_obra() and destino = 'obra' and enviado_por = auth.uid())
  );
create policy "equipe move midias" on public.midias for update to authenticated
  using (eh_equipe()) with check (eh_equipe());
create policy "apagar midias" on public.midias for delete to authenticated
  using (eh_equipe() or (enviado_por = auth.uid() and obra_codigo = minha_obra()));

-- ---------------------------------------------------------------------
-- 5. STORAGE (bucket "midias"): enviar e apagar arquivos
-- ---------------------------------------------------------------------
drop policy if exists "dl enviar arquivos" on storage.objects;
drop policy if exists "dl apagar arquivos" on storage.objects;
drop policy if exists "dl ler arquivos" on storage.objects;

-- (o Storage exige permissão de leitura para conseguir apagar)
create policy "dl ler arquivos" on storage.objects for select to authenticated
  using (bucket_id = 'midias');

create policy "dl enviar arquivos" on storage.objects for insert to authenticated
  with check (bucket_id = 'midias' and (public.eh_equipe() or public.minha_obra() is not null));

create policy "dl apagar arquivos" on storage.objects for delete to authenticated
  using (bucket_id = 'midias' and (public.eh_equipe() or owner_id = auth.uid()::text));
