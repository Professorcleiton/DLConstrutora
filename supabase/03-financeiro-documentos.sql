-- =====================================================================
-- DL Construtora – Parte 3: PRAZO, FINANCEIRO, DOCUMENTOS
--                  e cliente SÓ VISUALIZA a obra
-- Rode DEPOIS do 02-acessos.sql. Cole TUDO no SQL Editor > Run.
-- Pode rodar mais de uma vez sem problema.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. OBRAS: prazo de entrega e valores do contrato
-- ---------------------------------------------------------------------
alter table public.obras add column if not exists data_entrega_prevista date;   -- prazo do contrato
alter table public.obras add column if not exists entregue_em          date;   -- preenchido ao chegar em 100%
alter table public.obras add column if not exists valor_contrato       numeric(12,2);
alter table public.obras add column if not exists valor_entrada        numeric(12,2);
alter table public.obras add column if not exists valor_financiamento  numeric(12,2);

-- Quando o percentual chega a 100%, grava a data de entrega (e limpa se voltar)
create or replace function public.marcar_entrega()
returns trigger language plpgsql as $$
begin
  if new.percentual >= 100 and new.entregue_em is null then
    new.entregue_em := current_date;
  elsif new.percentual < 100 then
    new.entregue_em := null;
  end if;
  return new;
end $$;

drop trigger if exists obras_marcar_entrega on public.obras;
create trigger obras_marcar_entrega
  before insert or update of percentual on public.obras
  for each row execute function public.marcar_entrega();

-- Obras que já estão em 100%
update public.obras set entregue_em = current_date where percentual >= 100 and entregue_em is null;

-- ---------------------------------------------------------------------
-- 2. FINANCEIRO
-- ---------------------------------------------------------------------
-- Parcelas da entrada (pagas pelo cliente)
create table if not exists public.parcelas (
  id          bigint generated always as identity primary key,
  obra_codigo text not null references public.obras(codigo) on update cascade on delete cascade,
  numero      integer not null,
  vencimento  date not null,
  valor       numeric(12,2) not null check (valor >= 0),
  pago_em     date,
  valor_pago  numeric(12,2),
  observacao  text,
  criado_em   timestamptz not null default now()
);
create index if not exists parcelas_obra_idx on public.parcelas (obra_codigo, vencimento);

-- Repasses da Caixa para a construtora (medições)
create table if not exists public.repasses (
  id            bigint generated always as identity primary key,
  obra_codigo   text not null references public.obras(codigo) on update cascade on delete cascade,
  descricao     text not null,
  data_prevista date,
  data_recebida date,
  valor         numeric(12,2) not null check (valor >= 0),
  observacao    text,
  criado_em     timestamptz not null default now()
);
create index if not exists repasses_obra_idx on public.repasses (obra_codigo, data_prevista);

-- ---------------------------------------------------------------------
-- 3. DOCUMENTOS (contrato, comprovantes, projetos...)
--    Os arquivos ficam no bucket PRIVADO "documentos",
--    na pasta da obra: documentos/CDO-2026-001/arquivo.pdf
-- ---------------------------------------------------------------------
create table if not exists public.documentos (
  id          bigint generated always as identity primary key,
  obra_codigo text not null references public.obras(codigo) on update cascade on delete cascade,
  nome        text not null,
  categoria   text not null default 'outros'
              check (categoria in ('contrato', 'comprovante', 'projeto', 'nota_fiscal', 'outros')),
  caminho     text not null unique,
  tamanho     bigint,
  tipo_mime   text,
  parcela_id  bigint references public.parcelas(id) on delete set null,
  enviado_por uuid default auth.uid(),
  criado_em   timestamptz not null default now()
);
create index if not exists documentos_obra_idx on public.documentos (obra_codigo, criado_em desc);

insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do update set public = false;

-- ---------------------------------------------------------------------
-- 4. PERFIS: nome da pessoa (para o cadastro pelo app)
-- ---------------------------------------------------------------------
alter table public.perfis add column if not exists nome text;

-- listar_acessos passa a devolver o nome
drop function if exists public.listar_acessos();
create function public.listar_acessos()
returns table (user_id uuid, email text, nome text, papel text, obra_codigo text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not eh_equipe() then raise exception 'Apenas a equipe pode ver os acessos.'; end if;
  return query
    select u.id, u.email::text, p.nome, p.papel, p.obra_codigo
    from auth.users u
    left join perfis p on p.user_id = u.id
    order by p.papel nulls first, coalesce(p.nome, u.email::text);
end $$;
revoke all on function public.listar_acessos() from public, anon;
grant execute on function public.listar_acessos() to authenticated;

-- ---------------------------------------------------------------------
-- 5. SITE PÚBLICO: buscar_obra devolve também o prazo e a entrega
--    (os valores financeiros NÃO aparecem no site)
-- ---------------------------------------------------------------------
create or replace function public.buscar_obra(p_codigo text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'codigo',     o.codigo,
    'nome',       o.nome,
    'endereco',   o.endereco,
    'percentual', o.percentual,
    'atualizado_em', o.atualizado_em,
    'data_entrega_prevista', o.data_entrega_prevista,
    'entregue_em', o.entregue_em,
    'etapas', coalesce((
      select jsonb_agg(jsonb_build_object('nome', e.nome, 'status', e.status)
                       order by e.ordem, e.id)
      from etapas e
      where e.obra_codigo = o.codigo
    ), '[]'::jsonb),
    'midias', coalesce((
      select jsonb_agg(jsonb_build_object('url', m.url, 'tipo', m.tipo,
                                          'legenda', m.legenda, 'data_envio', m.data_envio)
                       order by m.data_envio desc nulls last, m.id desc)
      from midias m
      where upper(trim(m.obra_codigo)) = o.codigo
        and m.destino = 'obra'
    ), '[]'::jsonb)
  )
  from obras o
  where o.codigo = upper(trim(p_codigo));
$$;
revoke all on function public.buscar_obra(text) from public;
grant execute on function public.buscar_obra(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. PERMISSÕES BÁSICAS (o RLS abaixo decide o que cada um vê)
-- ---------------------------------------------------------------------
alter table public.parcelas   enable row level security;
alter table public.repasses   enable row level security;
alter table public.documentos enable row level security;

grant select, insert, update, delete on public.parcelas, public.repasses, public.documentos to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ---------------------------------------------------------------------
-- 7. REGRAS (RLS)
-- ---------------------------------------------------------------------
do $$
declare p record;
begin
  for p in
    select tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('midias', 'parcelas', 'repasses', 'documentos')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- MÍDIAS: cliente só VÊ as fotos publicadas da obra dele. Só a equipe envia/move/apaga.
create policy "ver midias" on public.midias for select to authenticated
  using (eh_equipe() or (obra_codigo = minha_obra() and destino = 'obra'));
create policy "equipe envia midias" on public.midias for insert to authenticated
  with check (eh_equipe());
create policy "equipe move midias" on public.midias for update to authenticated
  using (eh_equipe()) with check (eh_equipe());
create policy "equipe apaga midias" on public.midias for delete to authenticated
  using (eh_equipe());

-- PARCELAS e REPASSES: cliente só vê os da obra dele; equipe faz tudo.
create policy "ver parcelas" on public.parcelas for select to authenticated
  using (eh_equipe() or obra_codigo = minha_obra());
create policy "equipe gerencia parcelas" on public.parcelas for all to authenticated
  using (eh_equipe()) with check (eh_equipe());

create policy "ver repasses" on public.repasses for select to authenticated
  using (eh_equipe() or obra_codigo = minha_obra());
create policy "equipe gerencia repasses" on public.repasses for all to authenticated
  using (eh_equipe()) with check (eh_equipe());

-- DOCUMENTOS: cliente vê os da obra dele e só pode ENVIAR COMPROVANTE de uma parcela dela.
create policy "ver documentos" on public.documentos for select to authenticated
  using (eh_equipe() or obra_codigo = minha_obra());
create policy "enviar documentos" on public.documentos for insert to authenticated
  with check (
    eh_equipe()
    or (
      obra_codigo = minha_obra()
      and categoria = 'comprovante'
      and enviado_por = auth.uid()
      and parcela_id is not null
      and exists (select 1 from parcelas pa where pa.id = parcela_id and pa.obra_codigo = minha_obra())
      and caminho like minha_obra() || '/%'
    )
  );
create policy "equipe altera documentos" on public.documentos for update to authenticated
  using (eh_equipe()) with check (eh_equipe());
create policy "apagar documentos" on public.documentos for delete to authenticated
  using (eh_equipe() or (enviado_por = auth.uid() and obra_codigo = minha_obra()));

-- ---------------------------------------------------------------------
-- 8. STORAGE
-- ---------------------------------------------------------------------
-- Bucket "midias" (público para leitura): só a equipe envia.
-- Remove regras antigas que deixavam qualquer usuário logado enviar para "midias".
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and cmd = 'INSERT'
      and coalesce(with_check, '') ilike '%midias%'
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end $$;
create policy "dl enviar arquivos" on storage.objects for insert to authenticated
  with check (bucket_id = 'midias' and public.eh_equipe());

-- Bucket "documentos" (privado): pasta = código da obra
drop policy if exists "dl ver documentos"    on storage.objects;
drop policy if exists "dl enviar documentos" on storage.objects;
drop policy if exists "dl apagar documentos" on storage.objects;

create policy "dl ver documentos" on storage.objects for select to authenticated
  using (bucket_id = 'documentos'
         and (public.eh_equipe() or (storage.foldername(name))[1] = public.minha_obra()));

create policy "dl enviar documentos" on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos'
              and (public.eh_equipe() or (storage.foldername(name))[1] = public.minha_obra()));

create policy "dl apagar documentos" on storage.objects for delete to authenticated
  using (bucket_id = 'documentos'
         and (public.eh_equipe() or owner_id = auth.uid()::text));
