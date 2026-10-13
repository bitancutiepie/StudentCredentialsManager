# AGENT.md — Developer & AI Agent Playbook

> **Single Source of Truth** for any AI agent or engineer working in this repository.  
> Read this file first before making changes. Do NOT scan the entire codebase over and over.

---

## 1. Stack & Infrastructure

- **Architecture**: Vanilla HTML5, CSS3, modern ES6+ JavaScript (zero bundler, zero build step, no framework).
- **Backend / Database**: [Supabase](https://supabase.com) (PostgreSQL, Realtime WebSockets, Row Level Security, Storage Buckets).
- **Deployment**: Static Web App (compatible with GitHub Pages, Vercel, Netlify).
- **CDNs Loaded**:
  - Supabase JS SDK v2 (`@supabase/supabase-js`)
  - Font Awesome 6.5.2 (`https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css`)
  - Google Fonts (`Outfit:wght@300;400;500;600;700`, `Patrick+Hand`, `Permanent+Marker`)
  - EmailJS, html2canvas, PDF.js

---

## 2. Core File Tree & Responsibilities

| File | Purpose | Key Responsibilities |
|---|---|---|
| `index.html` | Entrance & Public Desk | Login/Register dual notebook, live classmate roster (`#publicMemberList`), recent activity (`#recentLoginsList`), desk stationery decorations. |
| `web2.html` | Main Binder Dashboard | Student desk bar, schedule timetable, homework planner, file cabinet, mini-games, direct messaging, birthday calendar. |
| `js/config.js` | App Configuration | Exports `window.APP_CONFIG` with Supabase project URL and anon public key. |
| `js/common.js` | Shared Utilities | Initializes `window.db = supabase.createClient()`, exports `showToast()`, `showWimpyConfirm()`, `escapeHTML()`, session persistence (`wimpy_user`). |
| `js/script.js` | Landing Page Controller | Auth flows, registration with SR-Code validation, live classmate roster updates, entrance animations. |
| `js/dashboard.js` | Dashboard Controller | Schedule rendering, homework CRUD, real-time broadcasts, student status updates, shock ("Hamilaw") cooldowns. |
| `css/common.css` | Design System Tokens | Color variables, 3-tier font tokens, global heading scale, `.sketch-btn`, `.card`, modals, toasts, scrollbars. |
| `css/auth.css` | Landing Page Styles | Dual-notebook responsive grid (1180px PC view), polaroids, member tags, desk stationary doodles. |
| `css/dashboard.css` | Binder Dashboard Styles | Notebook binder spiral, timetable cards, sticky notes, live clock, countdown pill, bulletin pinboard. |
| `css/games.css` | Arcade & Mini-Games | Wimpy Wordle, Minesweeper, Connect 4, Creature Battle, Tournaments, leaderboards. |
| `css/group-chat.css`| Class Bulletin & Chat | Group chat room, announcement overlays, speech bubbles, real-time message stream. |

---

## 3. Invariant Policies (STRICT — MUST NEVER BREAK)

### Policy 1: Strictly NO Unicode Emojis
- **FORBIDDEN**: Raw unicode characters (e.g., `🎂`, `📍`, `🔍`, `📂`, `⚔️`, `🎉`, `😎`, `👻`, `❤`).
- **MANDATORY**: Always use interactive **Font Awesome 6** vector icons or CSS glyphs:
  - In HTML/JS strings: `<i class="fas fa-birthday-cake"></i>`, `<i class="fas fa-folder-open"></i>`, `<i class="fas fa-ghost"></i>`.
  - In CSS `content`: `content: '\f00c'; font-family: 'Font Awesome 6 Free'; font-weight: 900;`.
- **Why**: Unicode emojis render inconsistently across Windows, macOS, Android, and iOS, breaking the uniform hand-drawn sketchbook aesthetic.

### Policy 2: Modern Unified Typography System
Never use cartoon cursive or comic marker fonts. The entire portal uses cohesive grotesque typography:

1. **Display & Impact (`--font-display: 'Outfit', sans-serif`)**:
   - Used for `h1`, `h2`, primary notebook titles, tab headers, major badge tags, game headings (`font-weight: 700-800`, tight letter-spacing).
2. **Workhorse Body & UI (`--font-body: 'Outfit', sans-serif`)**:
   - Used for general text, buttons (`.sketch-btn`), inputs, selects, table cells (`th`, `td`), countdown timers, chat bubbles, toasts, tooltips.
   - For numbers and dates, ALWAYS enable `font-variant-numeric: tabular-nums` to prevent layout jitter.
3. **Subtle Accents (`--font-accent: 'Outfit', sans-serif`)**:
   - Clean, readable accents for status lines and sticky notes without childish handwriting tropes.

### Policy 3: Non-Destructive Code Modifications
- **NEVER** rename or delete Supabase table columns, database foreign keys, or existing HTML element IDs (many JS functions rely on `document.getElementById`).
- **NEVER** alter the session storage key `wimpy_user` or auth payload structure.

---

## 4. Key Global State & Architecture

All cross-file shared state lives cleanly on `window`:

```javascript
window.user           // Authenticated student/admin profile object
window.db             // Active Supabase client
window.isAdmin        // Boolean flag (true if user.sr_code === 'ADMIN')
window.roomChannel    // Active Realtime broadcast/presence channel
```

### Script Execution Order
```html
<script src="js/config.js?v=2.0"></script>   <!-- 1. Sets window.APP_CONFIG -->
<script src="js/common.js?v=2.0"></script>   <!-- 2. Sets window.db, showToast, etc. -->
<script src="js/dashboard.js?v=2.0"></script><!-- 3. App logic (assumes window.db is ready) -->
```

### Dialogs & Alerts
- **Confirmations**: Always `const ok = await showWimpyConfirm('Prompt message'); if (!ok) return;`
- **Toasts**: `showToast('Message text', 'info' | 'success' | 'error');`
- **Escape User Input**: Always wrap dynamic user strings with `escapeHTML(str)`.

---

## 5. CSS & Layout Tokens

```css
:root {
    --font-body: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    --font-accent: 'Outfit', sans-serif;
    --font-display: 'Outfit', sans-serif;

    --color-primary: #0f172a;
    --color-surface: #ffffff;
    --color-text: #0f172a;
    --color-text-secondary: #64748b;
    --color-border: #e2e8f0;
    --color-accent: #2563eb;
    --color-danger: #ef4444;

    --radius-sm: 6px;
    --radius-md: 10px;
    --radius-lg: 14px;
    --radius-sketchy: 8px;
    --shadow-offset: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
}
```

- **Widescreen Desk Rule**:
  - `@media (min-width: 992px)`: Dual-notebook card layout (`max-width: 1180px`).
  - `@media (min-width: 1280px)`: Ambient desk accessories visible (`#background-decorations`).
  - `@media (max-width: 991px)`: Single-column vertically stacked fallback.

---

## 6. Developer Commands

```bash
# Syntax verification (fast, no build required):
node -c js/script.js
node -c js/dashboard.js
node -c js/common.js

# Linting & Formatting:
npm run lint          # ESLint v9 checks
npm run format        # Prettier formatting
npm run format:check  # Check formatting without writing
```

> **Git Guideline**: Only commit when explicitly requested by the user. Keep diffs focused, minimal, and verified.
