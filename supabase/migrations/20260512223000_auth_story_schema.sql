create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lane text not null default 'story',
  title text not null,
  year_label text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chapter_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.chapter_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  url text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.chapters enable row level security;
alter table public.chapter_entries enable row level security;
alter table public.chapter_photos enable row level security;

do $$ begin
  create policy "profiles owner" on public.profiles for all
    using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "chapters owner" on public.chapters for all
    using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "entries owner" on public.chapter_entries for all
    using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "photos owner" on public.chapter_photos for all
    using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (user_id) do update
  set full_name = excluded.full_name,
      updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user_profile();

insert into storage.buckets (id, name, public)
values ('chapter-photos', 'chapter-photos', true)
on conflict (id) do nothing;

do $$ begin
  create policy "chapter photos read" on storage.objects for select
    using (bucket_id = 'chapter-photos');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "chapter photos upload" on storage.objects for insert
    with check (bucket_id = 'chapter-photos' and auth.uid()::text = (storage.foldername(name))[1]);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "chapter photos update" on storage.objects for update
    using (bucket_id = 'chapter-photos' and auth.uid()::text = (storage.foldername(name))[1]);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "chapter photos delete" on storage.objects for delete
    using (bucket_id = 'chapter-photos' and auth.uid()::text = (storage.foldername(name))[1]);
exception when duplicate_object then null; end $$;
