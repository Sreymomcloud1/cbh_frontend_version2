# CBH Deployment Audit (Testing + Production)

This repository contains two deployable apps:
- Backend: `cbh-fixed-backend` (Express/TypeScript) -> Render
- Frontend: `cbh-fixed-frontend` (Next.js) -> Vercel

## Current Readiness

- **Backend build/start**: ready (`npm run build`, `npm start`)
- **Backend dev hot reload**: ready (`tsx watch`)
- **Frontend build/start**: ready (`next build`, `next start`)
- **Supabase integration**: ready in both apps
- **CORS strategy**: ready via `ALLOWED_ORIGINS` (comma-separated)
- **Deployment descriptors**: added (`render.yaml`, `vercel.json`)

## Environment Strategy

Use **one Supabase project** for both testing and production.

Keep these values the same in testing and production:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Change these values per environment:
- frontend/backed public URLs
- `ALLOWED_ORIGINS`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SITE_URL`
- `NODE_ENV`

## Recommended Topology

- Render service `cbh-backend-testing`
- Render service `cbh-backend-production`
- Vercel environment/project for Testing
- Vercel environment/project for Production

Both point to the same Supabase project, but use different app URLs.

## Critical Cross-Environment Settings

### Backend `ALLOWED_ORIGINS`
Must include all frontend origins that call the API, for example:
- `http://localhost:3000`
- `https://cbh-testing.vercel.app`
- `https://cbh.yourdomain.com`

### Frontend `NEXT_PUBLIC_API_URL`
Must target the matching backend:
- Testing frontend -> testing Render backend
- Production frontend -> production Render backend

## Render Deployment (Backend)

1. Connect repo to Render and create a Web Service for `cbh-fixed-backend`.
2. Use `render.yaml` as baseline (or configure manually).
3. Set env vars from:
   - `cbh-fixed-backend/.env.testing.example`
   - `cbh-fixed-backend/.env.production.example`
4. Deploy testing first, then production.

## Vercel Deployment (Frontend)

1. Import `cbh-fixed-frontend` into Vercel.
2. Configure env vars for:
   - Preview/Testing
   - Production
3. Use examples:
   - `cbh-fixed-frontend/.env.testing.example`
   - `cbh-fixed-frontend/.env.production.example`
4. Ensure each environment points to the correct backend URL.

## Post-Deploy Smoke Tests

1. Open frontend, login/signup flow works.
2. Call backend health endpoint: `/api/v1/health`.
3. Business dashboard loads without CORS issues.
4. Admin verify/reject/revoke updates status and messages.
5. Email links and redirects use correct `NEXT_PUBLIC_SITE_URL`.

