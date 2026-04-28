# CBH Frontend — Fixed & Production-Ready

Next.js + TypeScript + Supabase Auth

---

## 🐛 Bugs Fixed / Improvements

| File | Change |
|---|---|
| `src/app/auth/verify/page.tsx` | Added **Resend Verification Email** button with 60s cooldown, email input, and proper error states |
| `src/app/auth/signup/page.tsx` | Added resend email button on the post-signup verify step |
| `src/lib/api.ts` | Added `uploadAvatar`, `uploadBusinessLogo`, `uploadBusinessGalleryImage`, `resendVerificationEmail`, `forgotPassword` functions |
| `.env.example` | Added all required env vars with clear comments |

---

## 🚀 Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
# Edit .env.local with your values
```

### 3. Run

```bash
npm run dev      # development
npm run build    # production build
npm start        # serve production build
```

---

## 🔑 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |
| `NEXT_PUBLIC_API_URL` | ✅ | Backend API base URL |
| `NEXT_PUBLIC_ADMIN_EMAILS` | ✅ | Comma-separated admin emails (must match backend `ADMIN_EMAILS`) |
| `NEXT_PUBLIC_SITE_URL` | ✅ | Your frontend URL (for OG tags, email links) |

---

## 📤 File Uploads

Use the helpers in `src/lib/api.ts`:

```typescript
import { uploadAvatar, uploadBusinessLogo, uploadBusinessGalleryImage } from "@/lib/api";

// Upload avatar (updates profile.avatar_url automatically)
const url = await uploadAvatar(file);

// Upload business logo (updates business.logo_url automatically)
const url = await uploadBusinessLogo(file, businessId);

// Upload gallery image (appends to business.gallery_urls automatically)
const { url, gallery_urls } = await uploadBusinessGalleryImage(file, businessId);
```

All uploads go through the backend → Supabase Storage.
Max file size: 5 MB. Allowed types: JPEG, PNG, WEBP, GIF.

---

## 📧 Resend Verification Email

The verify page (`/auth/verify`) now has a full resend flow:
- User enters their email
- Clicks "Resend Verification Email"
- 60-second cooldown prevents spam
- Always shows a success message (prevents email enumeration)

The signup page also has a "Didn't receive it? Resend email" button on the post-signup screen.

---

## 👑 Admin Access

Users whose email matches `NEXT_PUBLIC_ADMIN_EMAILS` are redirected to `/admin` after login.
The admin check is also enforced server-side in the backend — the frontend redirect is just UX.
