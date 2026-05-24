-- IVFFlat with lists=100 defaults to probes=1, which often returns 0 rows for valid queries.
-- Raise probes inside match_chunks so semantic search has reliable recall at our corpus size (~3k vectors).

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
