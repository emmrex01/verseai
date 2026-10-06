-- Verse core schema.
-- Every user-owned row carries owner_id and is protected by Row Level Security.
-- The analysis worker uses the service role key and bypasses RLS.


-- ---------------------------------------------------------------------------
-- Profiles & billing
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  writing_type text check (writing_type in ('fiction','nonfiction','memoir','poetry','childrens','other')),
  writing_stage text check (writing_stage in ('planning','first_draft','revising','final','publishing','marketing')),
  onboarded_at timestamptz,
  ai_training_consent boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','author','pro','studio')),
  status text not null default 'active',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Every metered action (words analyzed, questions asked) and its model cost.
create table public.usage_events (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('analysis_words','question','free_tool')),
  quantity integer not null default 0,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(10,5) not null default 0,
  book_id uuid,
  created_at timestamptz not null default now()
);
create index usage_events_owner_month on public.usage_events (owner_id, kind, created_at);

-- Create profile + free subscription for every new auth user.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  insert into public.subscriptions (owner_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Books & manuscript structure: Book -> Version -> Chapter -> Paragraph
-- ---------------------------------------------------------------------------

create table public.books (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  genre text,
  subgenre text,
  language text not null default 'en',
  audience text,
  kind text not null default 'fiction' check (kind in ('fiction','nonfiction')),
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index books_owner on public.books (owner_id);

create table public.manuscript_versions (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  version_no integer not null,
  source_filename text,
  storage_path text,
  word_count integer not null default 0,
  chapter_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (book_id, version_no)
);

alter table public.books
  add constraint books_current_version_fk
  foreign key (current_version_id) references public.manuscript_versions (id) on delete set null;

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.manuscript_versions (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  idx integer not null,
  title text not null,
  word_count integer not null default 0,
  scene_count integer not null default 1,
  -- sha256 of normalized chapter text: unchanged chapters reuse prior extraction.
  content_hash text not null,
  -- Deterministic + extracted pacing signals, filled by the analysis run.
  metrics jsonb not null default '{}'::jsonb,
  unique (version_id, idx)
);
create index chapters_book on public.chapters (book_id);

create table public.paragraphs (
  id bigint generated always as identity primary key,
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  idx integer not null,
  scene_idx integer not null default 0,
  text text not null,
  tsv tsvector generated always as (to_tsvector('simple', text)) stored,
  unique (chapter_id, idx)
);
create index paragraphs_tsv on public.paragraphs using gin (tsv);
create index paragraphs_book on public.paragraphs (book_id);

-- ---------------------------------------------------------------------------
-- Analysis runs, the per-chapter extraction cache, and the Story Bible
-- ---------------------------------------------------------------------------

create table public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  version_id uuid not null references public.manuscript_versions (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed')),
  stage text not null default 'queued',
  progress integer not null default 0,
  error text,
  words_billed integer not null default 0,
  chapters_reused integer not null default 0,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(10,5) not null default 0,
  attempts integer not null default 0,
  -- Higher runs first: paid plans get priority in the queue.
  priority integer not null default 0,
  -- When the plan's manuscript limit is smaller than the book, only chapters
  -- with idx <= chapter_limit are analyzed (null = whole book).
  chapter_limit integer,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index analysis_runs_book on public.analysis_runs (book_id, created_at desc);
create index analysis_runs_queue on public.analysis_runs (status, created_at) where status in ('queued','running');

-- Raw structured extraction per chapter, keyed by content hash so revisions only
-- re-process changed chapters. Not exposed to clients directly.
create table public.chapter_extractions (
  owner_id uuid not null references auth.users (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  content_hash text not null,
  pipeline_version integer not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  primary key (book_id, content_hash, pipeline_version)
);

create table public.entities (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  run_id uuid not null references public.analysis_runs (id) on delete cascade,
  type text not null check (type in ('character','location','object','organization')),
  name text not null,
  aliases text[] not null default '{}',
  role text,
  summary text,
  profile jsonb not null default '{}'::jsonb,
  mention_count integer not null default 0,
  first_chapter_idx integer,
  last_chapter_idx integer,
  chapters_present integer[] not null default '{}'
);
create index entities_book on public.entities (book_id, type);

-- Atomic, evidence-backed statements about an entity. Every fact has a quote
-- that was verified to exist verbatim in the cited paragraph.
create table public.entity_facts (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  chapter_idx integer not null,
  paragraph_idx integer not null,
  category text not null,
  statement text not null,
  quote text not null
);
create index entity_facts_entity on public.entity_facts (entity_id);

create table public.relationships (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  run_id uuid not null references public.analysis_runs (id) on delete cascade,
  source_entity_id uuid not null references public.entities (id) on delete cascade,
  target_entity_id uuid not null references public.entities (id) on delete cascade,
  kind text not null,
  description text,
  evidence jsonb not null default '[]'::jsonb
);
create index relationships_book on public.relationships (book_id);

create table public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  run_id uuid not null references public.analysis_runs (id) on delete cascade,
  seq integer not null,
  chapter_idx integer not null,
  paragraph_idx integer not null,
  summary text not null,
  time_marker text,
  significance text not null default 'minor' check (significance in ('major','minor')),
  entity_names text[] not null default '{}',
  quote text not null
);
create index timeline_events_book on public.timeline_events (book_id, seq);

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  run_id uuid not null references public.analysis_runs (id) on delete cascade,
  category text not null check (category in ('character','timeline','location','object','plot','pacing')),
  severity text not null check (severity in ('critical','high','medium','low')),
  title text not null,
  explanation text not null,
  possible_intent text,
  suggestion text,
  entity_names text[] not null default '{}',
  evidence jsonb not null default '[]'::jsonb,
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  -- Stable fingerprint so dismissals survive re-analysis.
  fingerprint text not null,
  created_at timestamptz not null default now()
);
create index issues_book on public.issues (book_id, status, severity);

-- Fingerprints the author dismissed as intentional; re-runs suppress them.
create table public.issue_dismissals (
  book_id uuid not null references public.books (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  fingerprint text not null,
  created_at timestamptz not null default now(),
  primary key (book_id, fingerprint)
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  question text not null,
  answer text not null,
  support text not null,
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index questions_book on public.questions (book_id, created_at desc);

-- Abuse control for the no-account free tool (stores a salted IP hash only).
create table public.free_tool_runs (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  words integer not null,
  cost_usd numeric(10,5) not null default 0,
  created_at timestamptz not null default now()
);
create index free_tool_runs_ip on public.free_tool_runs (ip_hash, created_at);

-- ---------------------------------------------------------------------------
-- Job queue: the worker claims one run at a time with SKIP LOCKED.
-- Runs stuck "running" for 20 minutes (crashed worker) are reclaimed.
-- ---------------------------------------------------------------------------

create function public.claim_analysis_run() returns setof public.analysis_runs
language plpgsql security definer set search_path = public as $$
begin
  return query
  update public.analysis_runs r
     set status = 'running', locked_at = now(), attempts = r.attempts + 1
   where r.id = (
     select id from public.analysis_runs
      where (status = 'queued')
         or (status = 'running' and locked_at < now() - interval '20 minutes' and attempts < 3)
      order by priority desc, created_at
      limit 1
      for update skip locked)
  returning r.*;
end $$;
revoke execute on function public.claim_analysis_run() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_events enable row level security;
alter table public.books enable row level security;
alter table public.manuscript_versions enable row level security;
alter table public.chapters enable row level security;
alter table public.paragraphs enable row level security;
alter table public.analysis_runs enable row level security;
alter table public.chapter_extractions enable row level security;
alter table public.entities enable row level security;
alter table public.entity_facts enable row level security;
alter table public.relationships enable row level security;
alter table public.timeline_events enable row level security;
alter table public.issues enable row level security;
alter table public.issue_dismissals enable row level security;
alter table public.questions enable row level security;
alter table public.free_tool_runs enable row level security;

create policy "own profile" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- Billing rows are written only by the Stripe webhook (service role).
create policy "read own subscription" on public.subscriptions
  for select using (owner_id = auth.uid());
create policy "read own usage" on public.usage_events
  for select using (owner_id = auth.uid());

create policy "own books" on public.books
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Manuscript content is created by the server after parsing; authors may read
-- and delete their own content.
create policy "read own versions" on public.manuscript_versions for select using (owner_id = auth.uid());
create policy "delete own versions" on public.manuscript_versions for delete using (owner_id = auth.uid());
create policy "read own chapters" on public.chapters for select using (owner_id = auth.uid());
create policy "read own paragraphs" on public.paragraphs for select using (owner_id = auth.uid());
create policy "read own runs" on public.analysis_runs for select using (owner_id = auth.uid());
create policy "read own entities" on public.entities for select using (owner_id = auth.uid());
create policy "read own facts" on public.entity_facts for select using (owner_id = auth.uid());
create policy "read own relationships" on public.relationships for select using (owner_id = auth.uid());
create policy "read own timeline" on public.timeline_events for select using (owner_id = auth.uid());
create policy "read own issues" on public.issues for select using (owner_id = auth.uid());
create policy "update own issues" on public.issues for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own dismissals" on public.issue_dismissals
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "read own questions" on public.questions for select using (owner_id = auth.uid());
-- chapter_extractions and free_tool_runs: no client policies (service role only).

-- ---------------------------------------------------------------------------
-- Private storage for original manuscript files: manuscripts/{uid}/...
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public) values ('manuscripts', 'manuscripts', false)
on conflict (id) do nothing;

create policy "read own manuscript files" on storage.objects for select
  using (bucket_id = 'manuscripts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own manuscript files" on storage.objects for delete
  using (bucket_id = 'manuscripts' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Full-text retrieval for Ask Your Book. Runs as the caller, so RLS applies.
-- ---------------------------------------------------------------------------

create function public.search_paragraphs(
  p_book_id uuid,
  p_query text,
  p_max_chapter integer default null,
  p_limit integer default 40
) returns table (chapter_idx integer, chapter_title text, paragraph_idx integer, text text, rank real)
language sql stable security invoker set search_path = public as $$
  select c.idx, c.title, p.idx, p.text, ts_rank_cd(p.tsv, q) as rank
    from public.paragraphs p
    join public.chapters c on c.id = p.chapter_id
    join public.books b on b.id = p.book_id and c.version_id = b.current_version_id
    cross join websearch_to_tsquery('simple', p_query) q
   where p.book_id = p_book_id
     and p.tsv @@ q
     and (p_max_chapter is null or c.idx <= p_max_chapter)
   order by rank desc
   limit least(p_limit, 80);
$$;
