# Design System

## Theme

**"Wimpy Kid Sketchbook"** — hand-drawn, doodle aesthetic inspired by *Diary of a Wimpy Kid*. Paper textures, tape, pins, sketchy borders, and handwritten-style fonts throughout.

---

## Design Tokens

Defined in `:root` in `common.css` (shared) and `dashboard.css` (binder-specific).

### Colors

```css
/* Common */
--color-bg: #f9f5f0;
--color-surface: #ffffff;
--color-text: #2d3436;
--color-text-secondary: #636e72;
--color-primary: #2d3436;
--color-accent: #0984e3;        /* Blue — interactive elements */
--color-accent-hover: #0770c2;
--color-danger: #d63031;         /* Red — destructive actions, urgent */
--color-success: #00b894;        /* Green — success states */
--color-warning: #fdcb6e;        /* Yellow — warnings */
--color-highlight: #fff740;      /* Yellow — sticky notes, toasts */
--color-border: #e0d8cc;
--color-border-strong: #2d3436;

/* Dashboard (binder paper theme) */
--paper-color: #fdfbf7;
--line-color: #a4b0be;
--ink-color: #2f3542;
--red-ink: #ff4757;
--tape-color: rgba(255, 255, 255, 0.4);
```

### Typography

| Role | Font | Usage |
|------|------|-------|
| Body | `'Outfit', sans-serif` | Forms, tables, structured content |
| Accent/Handwritten | `'Patrick Hand', cursive` | Buttons, cards, playful text, toasts |
| Display/Headings | `'Permanent Marker', cursive` | Announcement titles, game headings |

**Scale:** xs (0.75rem), sm (0.875rem), base (1rem), lg (1.125rem), xl (1.25rem), 2xl (1.5rem), 3xl (2rem)

### Spacing

`--space-*`: xs (4px), sm (8px), md (16px), lg (24px), xl (32px), 2xl (48px)

### Shadows

| Token | Value |
|-------|-------|
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.06)` |
| `--shadow-md` | `0 2px 8px rgba(0,0,0,0.08)` |
| `--shadow-lg` | `0 4px 16px rgba(0,0,0,0.1)` |
| `--shadow-offset` | `3px 3px 0 #000` (hard sketch shadow) |

### Border Radii

| Token | Value |
|-------|-------|
| `--radius-sm` | 6px |
| `--radius-md` | 10px |
| `--radius-lg` | 12px |
| `--radius-sketchy` | `255px 15px 225px 15px / 15px 225px 15px 255px` |

### Transitions

| Token | Value |
|-------|-------|
| `--transition-fast` | 160ms ease-out |
| `--transition-base` | 200ms ease-out |
| `--transition-slow` | 300ms ease-out |
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` |
| `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` |

---

## Component Library

### `.sketch-btn`
Hand-drawn style button with offset shadow. Variants: `.danger` (red), `.primary` (blue), `.success` (green). Hover lifts, active scales down 0.97.

### `.btn-primary` / `.btn-secondary`
Structured form buttons (non-sketchy). Full-width. Used in auth forms and admin panels.

### `.wimpy-modal-overlay` + `.wimpy-modal-box`
Full-screen backdrop + centered modal card. Overlay has `backdrop-filter: blur(4px)`. Box animates in with slideUp. Variant: `.wide` (600px).

### `.sketch-box`
Offset-shadow card for playful sections (bulletin, admin tools). Variant: `.wide-mode`.

### `.card` / `.card-strong`
Standard card with subtle border. Hover lifts 2px. `.card-strong` has offset shadow.

### `.toast`
Yellow notification bar. Slides in from right. Variant: `.error` (red background).

### `.slide-toggle`
Accordion-style expand/collapse. Uses max-height + opacity transition with `--ease-out`.

### `.input-accent`
Playful input variant — no border box, just an underline. Uses `Patrick Hand` font.

### `.ann-mini-card`
Announcement sidebar card. Hover scales + rotates slightly. Contains timer progress bar.
- `.ann-timer-track` / `.ann-timer-fill` — 4px progress bar
- `.ann-timer-fill.mid` — yellow warning
- `.ann-timer-fill.low` — red danger
- `.ann-timer-label` — remaining time text

---

## Background

Dashboard body has a dark gray (`#3d3d3d`) background with a diagonal checkerboard pattern to simulate a sketchbook/grid paper feel.

---

## Animations

Keyframe library in `common.css`:
- `shake` — wiggle/shake effect
- `slideUp` — entrance from below
- `slideInRight` — entrance from right (toasts)
- `spin` — loading spinner
- `fadeIn` — opacity fade

Game-specific animations in `games.css`:
- `countdownPulse`, `timerPulse` — battle countdown
- `clashBurst`, `cardWobble` — battle effects

### Accessibility

```css
@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
        animation-duration: 0s;
        transition-duration: 0s;
    }
}
```

Hover effects gated behind `@media (hover: hover) and (pointer: fine)`.

---

## Icons

FontAwesome 6.5.2 via CDN. Used throughout for buttons, status indicators, and decorative elements.
