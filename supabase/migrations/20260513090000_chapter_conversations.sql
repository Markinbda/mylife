create table if not exists public.chapter_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  guide_id text not null default 'friend',
  role text not null check (role in ('guide', 'user')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_chapter_conversations_user_chapter_created
  on public.chapter_conversations(user_id, chapter_id, created_at);

alter table public.chapter_conversations enable row level security;

do $$ begin
  create policy "conversations owner" on public.chapter_conversations for all
    using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
