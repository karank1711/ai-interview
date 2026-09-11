-- Optional: persist profile photos on public.profiles.
-- Safe to run more than once. The app also stores avatar_url in auth user metadata.

alter table public.profiles add column if not exists avatar_url text;
