# Design

#design #ui #ux #css #design-system

## Design Philosophy

AI-TimeTable uses an **editorial ink + cream aesthetic** — inspired by quality print publishing. The goal is to feel authoritative, legible, and premium — like a well-typeset school official document — while being fully functional as a modern web app.

Key principles:
- **Legibility first** — timetable grids must be instantly scannable
- **Calm confidence** — no loud colors, animated distractions, or clutter
- **Dark mode parity** — equal visual quality in both modes
- **Print-ready** — CSS `@media print` produces clean, navless output

---

## Color Palette (OKLCH)

Using **OKLCH** color space for perceptually uniform, accessible colors (not hex).

### Light Mode (Default)

| Token | Value (OKLCH) | Purpose |
|---|---|---|
| `--background` | `oklch(0.965 0.012 85)` | Warm cream — page background |
| `--foreground` | `oklch(0.18 0.03 265)` | Deep ink — body text |
| `--ink` | `oklch(0.18 0.03 265)` | Same as foreground — alias |
| `--cream` | `oklch(0.965 0.012 85)` | Same as background — alias |
| `--paper` | `oklch(0.985 0.008 85)` | Slightly lighter — card surface |
| `--card` | `oklch(0.985 0.008 85)` | Card background |
| `--accent` | `oklch(0.72 0.17 55)` | Warm amber — links, focus rings, badges |
| `--muted` | `oklch(0.92 0.012 85)` | Muted backgrounds |
| `--muted-foreground` | `oklch(0.45 0.02 265)` | Secondary text |
| `--border` | `oklch(0.85 0.015 80)` | Subtle borders |
| `--destructive` | `oklch(0.55 0.2 25)` | Error red |

### Dark Mode

| Token | Value (OKLCH) |
|---|---|
| `--background` | `oklch(0.16 0.02 265)` — Deep slate |
| `--foreground` | `oklch(0.94 0.01 85)` — Off-white |
| `--paper` / `--card` | `oklch(0.21 0.025 265)` — Elevated surface |
| `--accent` | `oklch(0.78 0.16 55)` — Lighter amber |
| `--border` | `oklch(0.32 0.02 265)` — Subtle dark border |

---

## Typography

### Font Stack

| Role | Font | Google Fonts |
|---|---|---|
| **Display / Headings** | Instrument Serif | `family=Instrument+Serif:ital@0;1` |
| **Body / UI** | Work Sans | `family=Work+Sans:wght@300;400;500;600` |
| **Code / Labels / Monospaced** | JetBrains Mono | `family=JetBrains+Mono:wght@400;500` |

### Font Usage Rules

```css
h1, h2, h3, .font-display {
  font-family: 'Instrument Serif', ui-serif, Georgia, serif;
  font-weight: 400;
  letter-spacing: -0.02em;   /* Slightly tight for editorial feel */
}

body {
  font-family: 'Work Sans', ui-sans-serif, system-ui, sans-serif;
}

.font-mono {
  font-family: 'JetBrains Mono', monospace;
}
```

### Text Scale Examples (from codebase)

| Use | Class | Size |
|---|---|---|
| Page title | `font-display text-5xl` | 48px |
| Card heading | `font-display text-2xl` | 24px |
| Section label | `font-mono text-[11px] uppercase tracking-[0.22em]` | 11px monospaced |
| Body | (default) | 16px Work Sans |

---

## Design System Components (`components/ui/`)

### Button
- Primary: dark ink background, cream text
- Disabled: reduced opacity
- Hover: subtle shadow lift

### Card
- Background: `--card` (paper)
- Border: `--border`
- Hover variant: `hover:border-ink/30 hover:shadow-[0_8px_30px_-12px_rgba(20,20,40,0.12)]`

### Badge
- Color variants: `indigo`, `amber`, `green`, `red`
- Used for: board type, timetable status, rule type

### Input / Label
- Consistent with form accessibility (label + input pairing)
- Focus ring uses `--ring` (amber accent)

---

## Visual Motifs

### Grain Overlay
A subtle SVG noise texture applied to cards for a tactile, paper-like feel:

```css
.grain-overlay::after {
  background-image: var(--grain);   /* SVG fractal noise filter */
  opacity: 0.5;
  mix-blend-mode: multiply;
}
```

### Rule Lines
Decorative horizontal dividers that fade at the edges:
```css
.rule-line {
  background: linear-gradient(
    to right,
    transparent,
    var(--border) 20%,
    var(--border) 80%,
    transparent
  );
}
```

### Section Labels
Every page section is labeled with a monospaced micro-tag:
```
§ 01 — Dashboard
§ 02 — Your Schools
```

---

## Dark Mode Implementation

### No-Flash Script (in `layout.tsx`)
Applied before first paint to avoid a light flash on dark-mode users:

```js
(function() {
  try {
    var t = localStorage.getItem('tt_theme');
    if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
```

### Toggle Logic (`ThemeToggle.tsx`)
- Reads from localStorage key `"tt_theme"`
- Adds/removes `dark` class on `<html>` element
- CSS variables switch automatically via `.dark { ... }` selector

---

## Timetable Grid Design

The timetable is rendered as an HTML table:
- **Rows** = time periods (Period 1, Period 2, ...)
- **Columns** = weekdays (Mon, Tue, Wed, Thu, Fri)
- **Cells** = Subject name + Teacher name (subdued)
- Empty cells: shown as `—` or left blank
- Color coding: lab subjects get a distinct badge

### Print Styles
```css
@media print {
  .no-print { display: none !important; }   /* Hides header, nav, buttons */
}
```

Produces a clean, printable table that school admin can directly hand out.

---

## Responsive Layout

- Max content width: `max-w-7xl` (1280px)
- Horizontal padding: `px-6`
- Dashboard grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- Navigation links hidden on mobile: `hidden sm:inline`

---

## UX Patterns

### Loading State
```tsx
{isLoading && <p className="font-mono text-sm text-muted-foreground">Loading…</p>}
```

### Error State
```tsx
{error && (
  <Card className="border-destructive/30 bg-destructive/5">
    <p className="text-sm text-destructive">Couldn't reach the API.</p>
  </Card>
)}
```

### Empty State
```tsx
{data?.length === 0 && (
  <Card className="text-center py-16">
    <p className="font-display text-3xl">No schools yet.</p>
    <Link href="/setup">Create your first school</Link>
  </Card>
)}
```

---

## Accessibility

- Semantic HTML: `<header>`, `<main>`, `<nav>`, `<h1>` per page
- `aria-hidden` on decorative spans (e.g., arrow →)
- Font smoothing: `-webkit-font-smoothing: antialiased`
- Focus rings: amber `--ring` color visible in both modes
- `autoComplete` attributes on all form fields

---
*Related: [[10 - Frontend Setup & Dev]] · [[11 - Pages & Routing]] · [[Architecture]]*
