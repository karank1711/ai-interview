-- Run this entire file in Supabase SQL Editor.
-- Fixes signup ("Database error saving new user") and enables 6-digit email verification.

alter table public.profiles add column if not exists email_verified boolean;
update public.profiles set email_verified = true where email_verified is null;
alter table public.profiles alter column email_verified set default false;
alter table public.profiles alter column email_verified set not null;

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
