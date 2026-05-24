-- Allow semantic search scoped to a document type (e.g. dangerous goods list / Table C).

create or replace function public.match_chunks(
  query_embedding extensions.vector(1536),
  match_count int default 8,
  match_threshold float default 0.5,
  filter_document_type text default null
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
    and (filter_document_type is null or d.metadata->>'document_type' = filter_document_type)
    and 1 - (e.embedding <=> query_embedding) > match_threshold
  order by e.embedding <=> query_embedding
  limit match_count;
end;
$$;
