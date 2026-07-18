# Rules & Conventions

## Stack Rules

- **Vanilla HTML/CSS/JS only** — no frameworks, no bundlers, no build step
- **Supabase JS SDK v2** via CDN for database, realtime, auth, and storage
- **CDNs allowed**: Supabase JS SDK, EmailJS, html2canvas, PDF.js, Google Fonts, FontAwesome
- **Static hosting** (GitHub Pages compatible) — no server-side rendering

---

## Code Organization

### File naming
- HTML: lowercase with hyphens (`web2.html`, `web2_paused.html`)
- CSS: lowercase with hyphens (`group-chat.css`)
- JS: lowercase with hyphens (`creature-battle.js`, `file-manager.js`)

### Script loading
Always load in this order: `config.js` → `common.js` → page-specific JS.
Append cache-busting query param on deploy: `?v={version}`.

---

## JavaScript Conventions

### Global state
All cross-file state lives on `window.*`:
```js
window.user       // Current user object
window.db         // Supabase client (created in common.js)
window.isAdmin    // Boolean flag
window.roomChannel // Realtime channel reference
```

### Function declarations
Use named function expressions assigned to `window` for cross-file access:
```js
window.loadRecentAnnouncementsSidebar = async function () { ... };
```
Use plain `function` declarations for internal helpers within the same file.

### Async/await
Always use `async/await` for Supabase queries and realtime operations. No raw `.then()` chains.

### Supabase queries
```js
const { data, error } = await window.db.from('table').select('...').eq('...', val);
if (error) throw error;
```
Always destructure `data` and `error`. Always throw on error.

### Error handling
- User-facing errors: `showToast(message, 'error')`
- Debug logging: `console.error(...)`
- Network/db errors: throw and catch in the caller

### Confirmations
Destructive actions must confirm first:
```js
if (!(await showWimpyConfirm('Are you sure?'))) return;
```

### Type hints
Use JSDoc for function parameters and returns since there's no TypeScript:
```js
/**
 * @param {string} id
 * @param {string} message
 * @returns {Promise<void>}
 */
```

### Template literals
Use backtick template literals for HTML string construction.
Escape user content with `escapeHTML()` when interpolating into innerHTML.

---

## CSS Conventions

### Design tokens
Use CSS custom properties from `:root` in `common.css` exclusively. Avoid hardcoded values.
```css
/* Good */
.button { background: var(--color-accent); }

/* Avoid */
.button { background: #0984e3; }
```

### Class naming
Lowercase with hyphens. Descriptive, not visual.
```css
/* Good */
.ann-mini-card, .ann-timer-track, .wimpy-modal-overlay

/* Avoid */
.red-box, .big-text, .left-align
```

### Sketch aesthetic
Use the sketchy border-radius pattern for playful components:
```css
border-radius: var(--radius-sketchy); /* 255px 15px 225px 15px / 15px 225px 15px 255px */
```

### Animations
- Use CSS transitions (interruptible) over keyframes for rapidly-triggered UI
- Gate hover animations behind `@media (hover: hover) and (pointer: fine)`
- Respect `prefers-reduced-motion: reduce`
- Use `--ease-out` for element entry, `--ease-in-out` for on-screen movement
- Never use `ease-in` for UI elements (feels sluggish)
- Never animate from `scale(0)` — start from `scale(0.95)` with opacity

### Component properties
- Buttons: `transition: transform var(--transition-fast)`, `:active { transform: scale(0.97) }`
- Cards: `transition: transform var(--transition-fast), box-shadow var(--transition-base)`
- Only animate `transform` and `opacity` for performance

---

## HTML Conventions

### Script tags
```html
<script src="js/config.js?v=2.0"></script>
<script src="js/common.js?v=2.0"></script>
```

### Cache busting
Use a version suffix on all JS/CSS script tags. Bump on deploy.

### Inline styles
Prefer CSS classes over inline styles. Inline styles are acceptable only for truly dynamic values (e.g., rotation degrees, position coordinates).

---

## Security Rules

- **No plaintext passwords in code** (the Supabase anon key is public by design)
- All admin capabilities gated by `window.user.sr_code === 'ADMIN'` or `hasPermission()` checks
- Session spoofing protection: re-validate role from server on sensitive actions
- Admin-only UI elements use `.admin-only.hidden` class (shown via JS after permission check)

---

## Git Conventions

- Only commit when explicitly asked by the user
- Write concise commit messages matching repo style
- Never commit secrets or API keys
- Before committing: review `git status`, `git diff`, `git log --oneline -10`
- Stage only intended files

---

## Developer Commands

```bash
npm run lint          # ESLint check (warnings only)
npm run format        # Prettier auto-format
npm run format:check  # Prettier check (no write)
```

ESLint: flat config (`eslint.config.mjs`), warnings-only rules: `no-unused-vars`, `no-undef`, `prefer-const`, `no-var`, `eqeqeq`, `curly`.

Prettier: semi: true, singleQuote: true, tabWidth: 4, trailingComma: "all", printWidth: 120.

---

## Code Style Rules (from opencode)

- Do NOT add comments to code unless explicitly asked
- Mimic existing code style, use existing libraries, follow existing patterns
- When editing, first read the file to understand conventions
- Only 1-3 lines of explanation for responses unless the user asks for detail
