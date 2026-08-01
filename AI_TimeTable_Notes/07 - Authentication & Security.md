# 07 — Authentication & Security

#auth #security #jwt

## Auth Flow

1. User submits email + password to `POST /api/auth/login`
2. Backend verifies password using **scrypt** hash
3. On success: signs an **HS256 JWT** using `SECRET_KEY`
4. Frontend stores token in `localStorage` under key `"tt_token"`
5. Every subsequent request sends: `Authorization: Bearer <token>`
6. If a 401 is received: token is cleared and user is redirected to `/login`

## Password Hashing

- Uses Python's standard library `hashlib.scrypt`
- No external `bcrypt` or `passlib` dependency
- Located in `backend/app/core/security.py`

## JWT Tokens

- Algorithm: **HS256** (HMAC-SHA256)
- Payload: `{ "sub": user_id, "exp": ... }`
- No token refresh — single long-lived token (stateless)
- `SECRET_KEY` stored in environment variable

> ⚠️ **Important**: In production, always set `SECRET_KEY` to a long random string. Render auto-generates this from `render.yaml`.

## School Ownership Guard

Every admin API route checks two things:
1. ✅ Request has a valid JWT (`get_current_user`)
2. ✅ The requested school's `owner_id` matches the JWT's user ID (`require_school_access`)

This means admins can **never access or modify another admin's schools**.

Located in `backend/app/api/deps.py`.

## Parent Share Links

- Admin creates a share link → generates a **URL-safe random token**
- Parent accesses `/share/<token>` — no login required
- Backend strips teacher details from response (parents only see class timetable)
- Admin can **revoke instantly** — sets `ShareLink.revoked = True`
- Revoked tokens return 404

## Frontend Token Management

```typescript
// backend/src/lib/api.ts
const TOKEN_KEY = "tt_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}
```

## CORS Policy

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        # All origins OK
    allow_credentials=False,    # No cookies involved
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Permissive but safe — auth is token-based, not cookie-based.

## Production Checklist
- [ ] Set `SECRET_KEY` environment variable (not the default)
- [ ] Use PostgreSQL (not SQLite)
- [ ] Enable HTTPS on the backend host
- [ ] Consider restricting `allow_origins` to your Vercel domain

---
*Related: [[06 - API Endpoints Reference]] · [[13 - Local Development Guide]] · [[14 - Deployment Guide]]*
