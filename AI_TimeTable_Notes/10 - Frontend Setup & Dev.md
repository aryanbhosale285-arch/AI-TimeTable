# 10 — Frontend Setup & Dev

#frontend #nextjs #setup

## Directory Structure

```
frontend/
├── src/
│   ├── app/                    ← Next.js App Router pages
│   │   ├── layout.tsx          ← Root layout (header, fonts)
│   │   ├── globals.css         ← Tailwind base + CSS variables
│   │   ├── page.tsx            ← / Dashboard (school list)
│   │   ├── login/page.tsx      ← /login
│   │   ├── setup/page.tsx      ← /setup (New School wizard)
│   │   ├── school/[id]/        ← /school/:id
│   │   │   ├── page.tsx        ← School detail
│   │   │   └── timetable/      ← Timetable views
│   │   ├── rules/page.tsx      ← /rules
│   │   └── share/[token]/      ← /share/:token (public parent view)
│   │       └── page.tsx
│   ├── components/
│   │   ├── ui/                 ← Design system primitives
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Label.tsx
│   │   │   └── index.ts        ← Re-exports all
│   │   ├── ShareLinks.tsx      ← Share link manager + QR code
│   │   ├── ThemeToggle.tsx     ← Dark/light mode toggle
│   │   └── UserMenu.tsx        ← User menu (logout)
│   └── lib/
│       ├── api.ts              ← Auth-aware API client (all endpoints)
│       └── types.ts            ← TypeScript types (School, Teacher, etc.)
├── public/
│   └── template.csv            ← CSV upload template for admins
├── next.config.mjs             ← API proxy rewrite config
├── tailwind.config.ts
└── package.json
```

## Local Setup (First Time)

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
# → http://localhost:3000
```

## API Proxy Config (`next.config.mjs`)

```js
async rewrites() {
  return [{
    source: "/api/:path*",
    destination: `${process.env.BACKEND_URL || "http://localhost:8000"}/api/:path*`,
  }];
}
```

- Locally: `/api/*` → `http://localhost:8000/api/*`
- Production: Set `BACKEND_URL` env var on Vercel to your Render URL

## Theme System

### Dark Mode
- Toggle stored in `localStorage` as `"tt_theme"` (value: `"dark"` | `"light"`)
- Applied before first paint via inline `<script>` in `layout.tsx` to prevent FOUC
- CSS variables defined in `globals.css`

### Fonts (Google Fonts)
| Variable | Font | Usage |
|---|---|---|
| `font-display` | Instrument Serif | Headings |
| (default) | Work Sans | Body text |
| `font-mono` | JetBrains Mono | Code, labels |

## Data Fetching Pattern (SWR)

```tsx
// Standard pattern used across all pages
const { data, error, isLoading } = useSWR<School[]>("/schools", fetcher);

if (isLoading) return <p>Loading…</p>;
if (error) return <Card>Couldn't reach API</Card>;
return <div>{data?.map(...)}</div>;
```

SWR handles caching, revalidation, and error states automatically.

## Important: Auth Redirect

In `api.ts`, any `401` response triggers:
```typescript
clearToken();
window.location.href = "/login";
```
So unauthenticated users are automatically sent to `/login`.

---
*Related: [[11 - Pages & Routing]] · [[12 - API Client (lib-api)]] · [[13 - Local Development Guide]]*
