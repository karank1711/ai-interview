-- InterviewIQ schema
-- Run this entire file in Supabase Dashboard → SQL Editor → New query → Run.
--
-- Also configure:
-- 1. Authentication → Providers → Google (Client ID + Client Secret stay in the dashboard)
-- 2. Authentication → URL Configuration:
--    Site URL: http://localhost:5173
--    Redirect URLs: http://localhost:5173/auth/callback, http://localhost:3000/auth/callback
--
-- Passwords stay in auth.users. Application data lives in these tables only.

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null,
  phone_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_email_key on public.profiles (email);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_name text;
begin
  profile_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    split_part(new.email, '@', 1),
    'User'
  );

  insert into public.profiles (id, name, email, phone_number)
  values (
    new.id,
    profile_name,
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'phone_number'), '')
  )
  on conflict (id) do update
    set
      email = excluded.email,
      name = coalesce(nullif(trim(public.profiles.name), ''), excluded.name),
      phone_number = coalesce(public.profiles.phone_number, excluded.phone_number),
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- Interviews
-- ---------------------------------------------------------------------------
create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course text not null default 'BTECH',
  category text not null default 'GENERAL',
  level text not null default 'INTERMEDIATE',
  type text not null default 'TECHNICAL',
  status text not null default 'CREATED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists interviews_user_id_idx on public.interviews (user_id, created_at desc);
create index if not exists interviews_user_status_idx on public.interviews (user_id, status);

drop trigger if exists interviews_set_updated_at on public.interviews;
create trigger interviews_set_updated_at
before update on public.interviews
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Interview questions (snapshot generated for a session)
-- ---------------------------------------------------------------------------
create table if not exists public.interview_questions (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  question_key text not null,
  question_text text not null,
  course text,
  level text,
  type text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists interview_questions_interview_id_idx
  on public.interview_questions (interview_id, sort_order);

-- ---------------------------------------------------------------------------
-- Interview answers
-- ---------------------------------------------------------------------------
create table if not exists public.interview_answers (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id text,
  question text,
  answer text,
  time_taken integer default 0,
  score integer default 0,
  feedback text,
  created_at timestamptz not null default now()
);

create index if not exists interview_answers_interview_id_idx
  on public.interview_answers (interview_id, created_at);

-- ---------------------------------------------------------------------------
-- Interview results / history scores
-- ---------------------------------------------------------------------------
create table if not exists public.interview_results (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null unique references public.interviews (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  overall_score integer not null default 0,
  confidence_score integer not null default 0,
  communication_score integer not null default 0,
  technical_score integer not null default 0,
  problem_solving_score integer not null default 0,
  pass_fail boolean not null default false,
  grade text not null default 'F',
  strengths text not null default '',
  weaknesses text not null default '',
  improvements text not null default '',
  summary text not null default 'Result generated successfully.',
  per_question_feedback jsonb not null default '[]'::jsonb,
  visual_analysis jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists interview_results_user_id_idx
  on public.interview_results (user_id, created_at desc);

drop trigger if exists interview_results_set_updated_at on public.interview_results;
create trigger interview_results_set_updated_at
before update on public.interview_results
for each row
execute function public.set_updated_at();

alter table public.interview_results
  add column if not exists visual_analysis jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- Row Level Security: users can only access their own interview data
-- ---------------------------------------------------------------------------
alter table public.interviews enable row level security;
alter table public.interview_questions enable row level security;
alter table public.interview_answers enable row level security;
alter table public.interview_results enable row level security;

drop policy if exists "Users manage own interviews" on public.interviews;
create policy "Users manage own interviews"
  on public.interviews for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own interview questions" on public.interview_questions;
create policy "Users manage own interview questions"
  on public.interview_questions for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own interview answers" on public.interview_answers;
create policy "Users manage own interview answers"
  on public.interview_answers for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own interview results" on public.interview_results;
create policy "Users manage own interview results"
  on public.interview_results for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant usage on schema public to authenticated;
grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.interviews to authenticated;
grant select, insert, update, delete on table public.interview_questions to authenticated;
grant select, insert, update, delete on table public.interview_answers to authenticated;
grant select, insert, update, delete on table public.interview_results to authenticated;

-- ---------------------------------------------------------------------------
-- Email verification (6-digit codes hashed at rest; service role only)
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists email_verified boolean;
update public.profiles set email_verified = true where email_verified is null;
alter table public.profiles alter column email_verified set default false;
alter table public.profiles alter column email_verified set not null;

alter table public.profiles add column if not exists avatar_url text;

create table if not exists public.email_verification_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempt_count integer not null default 0,
  resend_count integer not null default 0,
  last_sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.email_verification_codes enable row level security;

-- ---------------------------------------------------------------------------
-- Interview Friend history
-- ---------------------------------------------------------------------------
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
