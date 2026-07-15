-- Full-text search over the knowledge base (EnsinoLibre/core#36): a
-- generated tsvector column + GIN index so search_resources scales past
-- "read everything" as the resources table grows (825+ rows already for the
-- demo teacher).
alter table public.resources
  add column if not exists search_vector tsvector
  generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(note, '') || ' ' || coalesce(subject, ''))
  ) stored;

create index if not exists resources_search_vector_idx on public.resources using gin (search_vector);
