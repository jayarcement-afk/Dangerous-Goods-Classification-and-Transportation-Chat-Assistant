-- DG Chat Assistant — Phase 1 schema
-- Enable pgvector for semantic search (Phase 2)

create extension if not exists vector with schema extensions;

-- pgvector types/operators live in the extensions schema on Supabase hosted Postgres
set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Documents & retrieval corpus
-- ---------------------------------------------------------------------------

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  edition text,
  source_url text,
  storage_path text,
  upload_status text not null default 'pending'
    check (upload_status in ('pending', 'processing', 'indexed', 'active', 'archived', 'failed')),
  is_active boolean not null default false,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  content text not null,
  chapter text,
  section text,
  page_reference text,
  table_reference text,
  chunk_index int not null default 0,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index chunks_document_id_idx on public.chunks (document_id);

-- 1536 dimensions — OpenAI text-embedding-3-small default; adjust in Phase 2 if needed
create table public.embeddings (
  id uuid primary key default gen_random_uuid(),
  chunk_id uuid not null unique references public.chunks (id) on delete cascade,
  embedding extensions.vector(1536) not null,
  model text not null,
  created_at timestamptz not null default now()
);

create index embeddings_vector_idx on public.embeddings
  using ivfflat (embedding extensions.vector_cosine_ops)
  with (lists = 100);

-- ---------------------------------------------------------------------------
-- Cases & chat
-- ---------------------------------------------------------------------------

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete set null,
  organization_id uuid,
  title text,
  status text not null default 'draft'
    check (status in ('draft', 'in_progress', 'review_ready', 'exported', 'archived')),
  access_scope text not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.case_inputs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  field text not null,
  value text,
  source text not null default 'user'
    check (source in ('user', 'assistant', 'system')),
  confidence text,
  created_at timestamptz not null default now()
);

create index case_inputs_case_id_idx on public.case_inputs (case_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index messages_case_id_idx on public.messages (case_id);

create table public.outputs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases (id) on delete set null,
  message_id uuid references public.messages (id) on delete set null,
  answer text,
  citations jsonb not null default '[]',
  confidence text,
  limitations text,
  model_version text,
  prompt_version text,
  retrieval_config jsonb not null default '{}',
  status text not null default 'generated'
    check (status in ('generated', 'refused', 'clarification')),
  refusal_reason text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Feedback & evaluation
-- ---------------------------------------------------------------------------

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  output_id uuid references public.outputs (id) on delete cascade,
  rating text check (rating in ('helpful', 'not_helpful', 'citation_issue')),
  citation_issue boolean not null default false,
  comments text,
  reviewer_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.eval_results (
  id uuid primary key default gen_random_uuid(),
  run_id text not null,
  model_version text,
  prompt_version text,
  retrieval_settings jsonb not null default '{}',
  pass_rate numeric,
  total int not null default 0,
  passed int not null default 0,
  failed_cases jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security (policies refined in Phase 4)
-- ---------------------------------------------------------------------------

alter table public.documents enable row level security;
alter table public.chunks enable row level security;
alter table public.embeddings enable row level security;
alter table public.cases enable row level security;
alter table public.case_inputs enable row level security;
alter table public.messages enable row level security;
alter table public.outputs enable row level security;
alter table public.feedback enable row level security;
alter table public.eval_results enable row level security;

-- Authenticated users can read active documents metadata (not raw ingest in v1 public read)
create policy "documents_read_active" on public.documents
  for select to authenticated
  using (is_active = true);

create policy "cases_owner_all" on public.cases
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "case_inputs_via_case" on public.case_inputs
  for all to authenticated
  using (
    exists (
      select 1 from public.cases c
      where c.id = case_inputs.case_id and c.owner_id = auth.uid()
    )
  );

create policy "messages_via_case" on public.messages
  for all to authenticated
  using (
    case_id is null
    or exists (
      select 1 from public.cases c
      where c.id = messages.case_id and c.owner_id = auth.uid()
    )
  );

create policy "outputs_via_case" on public.outputs
  for select to authenticated
  using (
    case_id is null
    or exists (
      select 1 from public.cases c
      where c.id = outputs.case_id and c.owner_id = auth.uid()
    )
  );

create policy "feedback_insert_authenticated" on public.feedback
  for insert to authenticated
  with check (true);

-- Service role handles ingestion; chunks/embeddings readable when document active
create policy "chunks_read_active_doc" on public.chunks
  for select to authenticated
  using (
    exists (
      select 1 from public.documents d
      where d.id = chunks.document_id and d.is_active = true
    )
  );

create policy "embeddings_read_active_doc" on public.embeddings
  for select to authenticated
  using (
    exists (
      select 1 from public.chunks ch
      join public.documents d on d.id = ch.document_id
      where ch.id = embeddings.chunk_id and d.is_active = true
    )
  );

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger documents_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

create trigger cases_updated_at
  before update on public.cases
  for each row execute function public.set_updated_at();

-- Semantic search RPC (Phase 2 implementation uses this signature)
create or replace function public.match_chunks(
  query_embedding extensions.vector(1536),
  match_count int default 8,
  match_threshold float default 0.5
)
returns table (
  chunk_id uuid,
  document_id uuid,
  content text,
  chapter text,
  section text,
  page_reference text,
  table_reference text,
  metadata jsonb,
  similarity float
)
language plpgsql
stable
set search_path = public, extensions
as $$
begin
  perform set_config('ivfflat.probes', '20', true);

  return query
  select
    c.id as chunk_id,
    c.document_id,
    c.content,
    c.chapter,
    c.section,
    c.page_reference,
    c.table_reference,
    c.metadata,
    1 - (e.embedding <=> query_embedding) as similarity
  from public.embeddings e
  join public.chunks c on c.id = e.chunk_id
  join public.documents d on d.id = c.document_id
  where d.is_active = true
    and 1 - (e.embedding <=> query_embedding) > match_threshold
  order by e.embedding <=> query_embedding
  limit match_count;
end;
$$;
