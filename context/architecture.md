# Architecture

## Overview

Vanilla HTML/CSS/JS application hosted as a static site (GitHub Pages compatible). Supabase serves as the backend (PostgreSQL, Auth, Realtime, Storage).

No frameworks, no bundlers, no build step.

---

## Entry Points

| Page | Purpose | Key JS | CSS |
|------|---------|--------|-----|
| `index.html` | Landing, auth (login/signup), admin blacklist dashboard | `script.js` | `common.css`, `auth.css`, `admin.css` |
| `web2.html` | Main app ("The Binder") — student dashboard | `dashboard.js`, `admin.js`, `messaging.js`, `group-chat.js` | `common.css`, `dashboard.css`, `group-chat.css`, `games.css` |
| `web2_paused.html` | Paused/disabled state of the binder | (minimal JS) | `common.css` |

---

## Script Loading Order

Every HTML page loads scripts in this exact order:

```
config.js → common.js → [page-specific JS files]
```

1. **`config.js`** — sets `window.APP_CONFIG` with hardcoded Supabase URL + anon key
2. **`common.js`** — reads `APP_CONFIG`, creates `window.db = supabase.createClient(...)`, defines shared utilities (`showToast`, `escapeHTML`, `showWimpyConfirm`, `showAnnouncementPopup`, etc.)
3. **Page-specific JS** — assumes `window.db` and shared functions are ready

---

## File Responsibility

### CSS

| File | Scope |
|------|-------|
| `common.css` | Design tokens (CSS vars), shared components (modals, buttons, cards, inputs, toasts), animations, utilities |
| `auth.css` | Login/signup page styling |
| `admin.css` | Blacklist dashboard enhancements |
| `dashboard.css` | Binder layout, schedule, calendar, class countdown, resource cabinet, freedom wall, profile |
| `games.css` | Creature Battle, Minesweeper, Wordle |
| `group-chat.css` | Group chat, announcement mini-cards |

### JS

| File | ~Lines | Responsibility |
|------|--------|----------------|
| `config.js` | 9 | Supabase credentials |
| `common.js` | 763 | Supabase client init, shared UI (toast, modal, confirm, announcement popup, comments), session helpers, permission checks |
| `script.js` | 3147 | Auth flow, admin blacklist dashboard, landing page, file uploads, freedom wall CRUD, gallery, wallpaper generator |
| `dashboard.js` | 3081 | Binder UI — schedule, calendar, assignments, events, class countdown, resource cabinet, announcements sidebar, avatar upload, profile, requests, freedom wall drag |
| `admin.js` | 937 | Admin tools within binder — announcement broadcast, schedule CRUD, homework/events CRUD, file management, role management, auto-cleanup, wordle admin |
| `messaging.js` | ~520 | Peer-to-peer messaging (conversation list, send, read receipts, delete, clear) |
| `group-chat.js` | ~500 | Group chat (realtime, reactions, hidden messages) |
| `creature-battle.js` | ~900 | Creature Battle game (card selection, AI, battle logic, countdown, animations) |
| `minesweeper.js` | ~360 | Minesweeper game |
| `wordle.js` | ~360 | Wordle game |
| `file-manager.js` | ~660 | File manager, user status, schedule viewer, profile editor, status dashboard |
| `pdf-scanner.js` | ~200 | PDF schedule scanning/parsing |

---

## Data Flow

```
User Action → Event Handler → Supabase REST/Realtime → UI Update
                    ↓
            window.db.query()
                    ↓
        Supabase PostgreSQL + Realtime
```

- **Realtime channels** (`window.roomChannel`): live updates for announcements, comments, messages, notes, presence
- **REST queries**: most CRUD operations (schedule, assignments, events, files)
- **Session state**: persisted to `localStorage` or `sessionStorage` under key `wimpy_user`
- **Cross-file state**: all shared state lives on `window.*` (e.g., `window.user`, `window.db`, `window.isAdmin`)

---

## Realtime Channels

All pages subscribe to `room-1` channel for:
- `announcement` — new global announcement
- `comment` — new comment on announcement
- `delete_announcement` — announcement removed
- `hamilaw` — global shock/scare effect
- `system_reload` — force page reload

Group chat uses its own channel for chat messages.

---

## Key Utilities (from `common.js`)

| Function | Purpose |
|----------|---------|
| `showToast(msg, type)` | Toast notification (default or 'error') |
| `escapeHTML(str)` | Sanitize strings for innerHTML |
| `showWimpyConfirm(msg)` | Async confirmation dialog (returns boolean) |
| `hasPermission(toolName)` | Check admin tool access |
| `showAnnouncementPopup(data)` | Full-screen announcement modal |
| `loadAnnouncementComments(id)` | Fetch comments for announcement |
| `postAnnouncementComment(id)` | Post comment to announcement |
| `timeAgo(date)` | Relative time formatting |
| `checkActiveAnnouncements()` | Recover active announcement on page load |
