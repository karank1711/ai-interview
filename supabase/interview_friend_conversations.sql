-- Interview Friend conversation history (run in Supabase SQL Editor).
-- Backend also filters every query by authenticated user_id.
-- RLS keeps browser/anon access limited to the signed-in user.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.interview_friend_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'New conversation',
  mode text not null default 'general',
  messages jsonb not null default '[]'::jsonb,
  videos jsonb not null default '[]'::jsonb,
  exclude_video_ids jsonb not null default '[]'::jsonb,
  video_query text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists interview_friend_conversations_user_updated_idx
  on public.interview_friend_conversations (user_id, updated_at desc);

drop trigger if exists interview_friend_conversations_set_updated_at on public.interview_friend_conversations;
create trigger interview_friend_conversations_set_updated_at
before update on public.interview_friend_conversations
for each row
execute function public.set_updated_at();

alter table public.interview_friend_conversations enable row level security;

drop policy if exists "Users can view own friend conversations" on public.interview_friend_conversations;
create policy "Users can view own friend conversations"
  on public.interview_friend_conversations for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own friend conversations" on public.interview_friend_conversations;
create policy "Users can insert own friend conversations"
  on public.interview_friend_conversations for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own friend conversations" on public.interview_friend_conversations;
create policy "Users can update own friend conversations"
  on public.interview_friend_conversations for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own friend conversations" on public.interview_friend_conversations;
create policy "Users can delete own friend conversations"
  on public.interview_friend_conversations for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on table public.interview_friend_conversations to authenticated;
grant all on table public.interview_friend_conversations to service_role;
