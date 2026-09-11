-- Add camera visual analysis storage for existing InterviewIQ databases.
-- Run this in the Supabase SQL editor if interview_results already exists.

alter table public.interview_results
  add column if not exists visual_analysis jsonb not null default '{}'::jsonb;

comment on column public.interview_results.visual_analysis is
  'MediaPipe Face Landmarker session metrics persisted at interview completion.';
