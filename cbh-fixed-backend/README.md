# CBH Backend — Fixed & Production-Ready

Node.js + Express + TypeScript + Supabase

---

## 🐛 Bugs Fixed

| File | Bug | Fix |
|---|---|---|
| `src/routes/feedback.routes.ts` | Used `authenticate` which doesn't exist | Changed to `requireAuth` |
| `src/controllers/business.controller.ts` | `req.supabase` is `undefined` on public routes (list, getOne) — crashes every business listing call | Added `getPublicClient()` fallback |
| `src/config/env.ts` | Missing `ADMIN_EMAILS`, `AVATAR_BUCKET`, `SUPABASE_STORAGE_BUCKET` env vars | Added all missing vars |

---

## 🆕 New Files

| File | Purpose |
|---|---|
| `src/services/upload.service.ts` | Supabase Storage upload/delete with MIME + size validation |
| `src/routes/upload.routes.ts` | `/upload/avatar`, `/upload/business-logo`, `/upload/business-gallery` |
| `src/routes/admin.routes.ts` | Admin-only routes: manage businesses, users, view stats |
| `src/routes/auth.routes.ts` | `/auth/resend-verification`, `/auth/forgot-password` |
| `supabase/storage.sql` | Storage bucket creation + RLS policies |

---

## 🚀 Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your values
```

### 3. Set up Supabase

In **Supabase Dashboard → SQL Editor**, run these files in order:

1. `supabase/schema.sql`
2. `supabase/rls.sql`
3. `supabase/storage.sql`  ← NEW (creates buckets + storage RLS)
4. `supabase/seed.sql` (optional, dev only)

### 4. Run

```bash
npm run dev      # development (hot reload)
npm run build    # compile TypeScript
npm start        # production
```

---

## 👑 Admin Setup

Admins are identified by email address — no database role needed.

1. Add admin emails to `.env`:
   ```
   ADMIN_EMAILS=admin@yourdomain.com,ceo@yourdomain.com
   ```
2. Restart the server.
3. When those users log in via the frontend, they are redirected to `/admin`.
4. All `/api/v1/admin/*` routes check this list server-side — users cannot self-promote.

**Why email-based?**
Storing admin status in JWT metadata is insecure because users can potentially manipulate it.
Server-side email list is the simplest, safest approach for a platform of this scale.

---

## 📁 API Routes

### Auth (no auth required)
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/auth/resend-verification` | Resend email verification link |
| POST | `/api/v1/auth/forgot-password` | Send password reset email |

### Profile (auth required)
| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/profile/me` | Get own profile |
| PATCH | `/api/v1/profile/me` | Update profile |
| GET | `/api/v1/profile/me/saved` | Saved businesses |
| POST | `/api/v1/profile/me/saved/:businessId` | Toggle save business |
| GET | `/api/v1/profile/me/rewards` | Reward points + history |

### Businesses
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/businesses` | Public | List with filters |
| GET | `/api/v1/businesses/:id` | Public | Get one |
| GET | `/api/v1/businesses/me/profile` | Required | My business |
| POST | `/api/v1/businesses` | Required | Create business |
| PATCH | `/api/v1/businesses/:id` | Required | Update business |
| PATCH | `/api/v1/businesses/:id/eco-score` | Required | Update eco score |
| DELETE | `/api/v1/businesses/:id` | Required | Soft delete |

### Upload (auth required, multipart/form-data)
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/upload/avatar` | Upload profile avatar |
| POST | `/api/v1/upload/business-logo` | Upload business logo (`business_id` in body) |
| POST | `/api/v1/upload/business-gallery` | Add gallery image (`business_id` in body) |

### Admin (auth required + admin email)
| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/admin/stats` | Platform overview stats |
| GET | `/api/v1/admin/businesses` | All businesses (incl. inactive) |
| PATCH | `/api/v1/admin/businesses/:id` | Verify / deactivate business |
| DELETE | `/api/v1/admin/businesses/:id` | Hard delete business |
| GET | `/api/v1/admin/users` | All user profiles |
| PATCH | `/api/v1/admin/users/:id` | Update user role / verification |

### Other
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/requests` | Required | Buyer: my requests |
| GET | `/api/v1/requests/business` | Required | Business: incoming requests |
| POST | `/api/v1/requests` | Required | Create request |
| PATCH | `/api/v1/requests/:id/status` | Required | Update status |
| GET | `/api/v1/messages` | Required | My conversations |
| GET | `/api/v1/messages/unread` | Required | Unread count |
| POST | `/api/v1/messages/:id` | Required | Send message |
| GET | `/api/v1/reviews/:businessId` | Public | Get reviews |
| POST | `/api/v1/reviews/:businessId` | Required | Submit review |
| POST | `/api/v1/feedback` | Required | Submit feedback |
| GET | `/api/v1/health` | Public | Health check |

---

## 🔒 Security Features

- **Helmet** — sets secure HTTP headers (XSS, clickjacking, MIME sniffing protection)
- **CORS** — only allows origins listed in `ALLOWED_ORIGINS`
- **Rate limiting** — 200 req/15 min globally; 10 req/15 min on auth endpoints
- **JWT validation** — every protected route verifies the token with Supabase (not just decodes it)
- **RLS** — Row Level Security enforced at the database layer
- **Admin email list** — admin access checked server-side, never from JWT metadata
- **Input validation** — all request bodies validated with Zod schemas
- **File upload validation** — MIME type + file size checked before storage upload
- **Email enumeration prevention** — resend/forgot-password always return success
