# InterviewIQ Node Backend

This backend is built for the existing frontend service layer in `frontend/src/services`.

## 1) Setup

```bash
cd backend-node
cp .env.example .env
npm install
npm run dev
```

## 2) Required environment variables

- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase secret key (`sb_secret_...`), server-side only

Apply `supabase/schema.sql` in the Supabase SQL Editor before starting the API.

## 3) Frontend config

Create `frontend/.env`:

```bash
VITE_API_URL=http://localhost:8081/api
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_your_publishable_key
```

## 4) Implemented endpoint groups

- `GET /api/auth/me`
- `PUT /api/auth/profile`
- `POST /api/auth/forgot-password` (placeholder)
- `POST /api/auth/reset-password` (placeholder)
- `POST /api/auth/verify-email` (placeholder)
- `POST /api/interviews/start`
- `GET /api/interviews/:id`
- `GET /api/interviews/history`
- `GET /api/interviews/active`
- `PUT /api/interviews/:id/status`
- `POST /api/interviews/:id/answer`
- `POST /api/interviews/:id/complete`
- `DELETE /api/interviews/:id`
- `GET /api/questions/generate`
- `GET /api/results/:interviewId`
- `GET /api/results/history`
