-- =====================================================================
-- DL Construtora – Banco de dados no Supabase (substitui o Google Sheets)
-- Cole TUDO no Supabase: SQL Editor > New query > Run.
-- Pode rodar mais de uma vez sem problema.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. TABELA "obras" ANTIGA (id, nome, percentual, slug)
--    Se existir uma tabela obras sem a coluna "codigo", ela é guardada
--    com o nome obras_antiga (nada é apagado). Ligações (foreign keys)
--    de outras tabelas para ela são removidas, para não travar o app.
-- ---------------------------------------------------------------------
do $$
declare fk record;
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'obras')
     and not exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'obras' and column_name = 'codigo')
  then
    if exists (select 1 from information_schema.tables
               where table_schema = 'public' and table_name = 'obras_antiga') then
      raise exception 'Já existe uma tabela obras_antiga. Renomeie ou apague uma delas e rode de novo.';
    end if;

    for fk in
      select c.conname, c.conrelid::regclass as tabela
      from pg_constraint c
      where c.contype = 'f'
        and c.confrelid = 'public.obras'::regclass
        and c.conrelid <> 'public.obras'::regclass
    loop
      execute format('alter table %s drop constraint %I', fk.tabela, fk.conname);
      raise notice 'Removida ligação % da tabela %', fk.conname, fk.tabela;
    end loop;

    alter table public.obras rename to obras_antiga;
    alter table public.obras_antiga enable row level security;
    raise notice 'Tabela obras antiga guardada como obras_antiga';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. TABELA DE OBRAS
-- ---------------------------------------------------------------------
create table if not exists public.obras (
  codigo        text primary key check (codigo = upper(trim(codigo))),
  nome          text not null,
  endereco      text,
  percentual    integer not null default 0 check (percentual between 0 and 100),
  atualizado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. TABELA DE ETAPAS (cada obra tem várias, em ordem)
-- ---------------------------------------------------------------------
create table if not exists public.etapas (
  id          bigint generated always as identity primary key,
  obra_codigo text not null references public.obras(codigo) on update cascade on delete cascade,
  ordem       integer not null default 0,
  nome        text not null,
  status      text not null default 'pendente'
              check (status in ('pendente', 'andamento', 'concluida'))
);
create index if not exists etapas_obra_idx on public.etapas (obra_codigo, ordem);

-- Atualiza "atualizado_em" sempre que a obra mudar
create or replace function public.tocar_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists obras_atualizado_em on public.obras;
create trigger obras_atualizado_em
  before update on public.obras
  for each row execute function public.tocar_atualizado_em();

-- ---------------------------------------------------------------------
-- 3. SEGURANÇA (RLS)
--    Visitante do site (anon): NÃO lê as tabelas direto. Ele só consegue
--    buscar UMA obra por vez, sabendo o código (função buscar_obra abaixo).
--    Assim ninguém consegue listar os nomes de todos os clientes.
--    Usuário logado no app (authenticated): lê e edita tudo.
-- ---------------------------------------------------------------------
alter table public.obras  enable row level security;
alter table public.etapas enable row level security;
alter table public.midias enable row level security;

drop policy if exists "equipe gerencia obras"  on public.obras;
drop policy if exists "equipe gerencia etapas" on public.etapas;

-- Projetos novos do Supabase não liberam as tabelas automaticamente:
-- dá à equipe logada a permissão básica (o RLS continua filtrando).
grant select, insert, update, delete on public.obras  to authenticated;
grant select, insert, update, delete on public.etapas to authenticated;
grant select, insert on public.midias to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create policy "equipe gerencia obras" on public.obras
  for all to authenticated using (true) with check (true);

create policy "equipe gerencia etapas" on public.etapas
  for all to authenticated using (true) with check (true);

-- Mídias: troca a leitura pública antiga por leitura só da equipe.
-- (O site passa a receber as fotos pela função buscar_obra.)
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'midias' and cmd = 'SELECT'
  loop
    execute format('drop policy %I on public.midias', p.policyname);
  end loop;
end $$;

create policy "equipe le midias" on public.midias
  for select to authenticated using (true);

-- ---------------------------------------------------------------------
-- 4. FUNÇÃO QUE O SITE CHAMA: buscar_obra('CDO-2026-001')
--    Devolve a obra + etapas + fotos/vídeos (destino = 'obra') de uma vez.
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
-- 5. DADOS INICIAIS (copiados do antigo data/obras.json)
--    Confira se o percentual e as etapas batem com o que estava na planilha.
--    Depois você edita tudo pelo app (/app/ > Gerenciar obras).
-- ---------------------------------------------------------------------
insert into public.obras (codigo, nome, endereco, percentual) values
  ('CDO-2026-001', 'Casa Residencial – Jaqueline & Cleiton', 'Bairro Jardim Cruzeiro, Cruzeiro do Oeste/PR', 3),
  ('CDO-2025-002', 'Casa Popular – Família Souza', 'Conjunto Primavera, Cruzeiro do Oeste/PR', 15)
on conflict (codigo) do nothing;

insert into public.etapas (obra_codigo, ordem, nome, status)
select v.codigo, v.ordem, v.nome, v.status
from (values
  ('CDO-2026-001', 1, 'Documentação Inicial', 'andamento'),
  ('CDO-2026-001', 2, 'Fundação',             'pendente'),
  ('CDO-2026-001', 3, 'Estrutura',            'pendente'),
  ('CDO-2026-001', 4, 'Alvenaria',            'pendente'),
  ('CDO-2026-001', 5, 'Cobertura',            'pendente'),
  ('CDO-2026-001', 6, 'Acabamento',           'pendente'),
  ('CDO-2026-001', 7, 'Entrega',              'pendente'),
  ('CDO-2025-002', 1, 'Documentação Inicial', 'concluida'),
  ('CDO-2025-002', 2, 'Fundação',             'andamento'),
  ('CDO-2025-002', 3, 'Estrutura',            'pendente'),
  ('CDO-2025-002', 4, 'Alvenaria',            'pendente'),
  ('CDO-2025-002', 5, 'Cobertura',            'pendente'),
  ('CDO-2025-002', 6, 'Acabamento',           'pendente'),
  ('CDO-2025-002', 7, 'Entrega',              'pendente')
) as v(codigo, ordem, nome, status)
where not exists (select 1 from public.etapas e where e.obra_codigo = v.codigo);

-- Fotos antigas que ficam no próprio site (pasta img/obras)
insert into public.midias (obra_codigo, url, tipo, legenda, destino, data_envio)
select v.codigo, v.url, 'foto', null, 'obra', now() - interval '30 days' - v.n * interval '1 minute'
from (values
  ('CDO-2026-001', 'img/obras/001-foto1.jpeg', 1),
  ('CDO-2026-001', 'img/obras/001-foto2.jpeg', 2),
  ('CDO-2026-001', 'img/obras/001-foto3.jpeg', 3)
) as v(codigo, url, n)
where not exists (select 1 from public.midias m where m.url = v.url);

-- Grava automaticamente quem enviou cada mídia (usuário logado no app)
alter table public.midias alter column enviado_por set default auth.uid();

-- Corrige códigos de mídias já enviadas que tenham espaço ou letra minúscula
update public.midias set obra_codigo = upper(trim(obra_codigo))
where obra_codigo <> upper(trim(obra_codigo));
