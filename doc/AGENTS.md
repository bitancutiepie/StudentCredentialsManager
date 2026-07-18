# AGENTS.md — Project Conventions

## File Map
```
/ (root)
├── index.html          # Auth & landing page
├── web2.html           # Main app (binder/dashboard) — monolithic
├── css/
│   ├── common.css      # Shared animations, utilities, buttons, modals, toasts
│   ├── style.css       # Theme, freedom wall, gallery, responsive
│   ├── dashboard.css   # Binder/dashboard-specific styles
│   ├── games.css       # Wordle, Minesweeper, Creature Battle
│   └── blacklist-enhancements.css
├── js/
│   ├── config.js       # Centralized config (secrets, constants)
│   ├── common.js       # Shared utilities (escapeHTML, showToast, debounce, compressImage, etc.)
│   ├── script.js       # Auth logic, admin panel (Black List), landing page
│   ├── dashboard.js    # Main binder app (schedule, assignments, calendar, live class)
│   ├── admin.js        # Admin tool forms, storage monitor, promote/revoke
│   ├── messaging.js    # 1:1 chat system
│   ├── group-chat.js   # Group chat system
│   ├── minesweeper.js  # Minesweeper game
│   ├── wordle.js       # Wordle game
│   ├── creature-battle.js # Creature Battle PvP game
│   └── pdf-scanner.js  # PDF preview tool
├── assets/
│   ├── images/         # Logo, creatures, decorations
│   └── ...
└── AGENTS.md           # This file
```

## Coding Conventions

### JavaScript
- **No TypeScript** — Use JSDoc `@param`, `@returns`, `@typedef` for type info
- **IIFE wrapping** — Each file wraps in `(function(){ 'use strict'; /* ... */ })();`
- **`window.*` globals** — Cross-file shared functions/states go on `window`. Prefix with descriptive names.
- **DOM queries** — Cache repeated lookups: `const el = document.getElementById('id')`
- **Async** — Prefer `async/await` over `.then()`. Use `try/catch` consistently.
- **Events** — Use `addEventListener`, not inline `onclick="..."`.
- **Strings** — Template literals over concatenation.
- **Error handling** — Use `showToast(errMsg, 'error')` for user-facing; `console.error` for debugging.

### CSS
- **No preprocessors** — Plain CSS with custom properties (`--var`) where possible.
- **Naming** — `.kebab-case` for classes, semantic names.
- **Sketchy aesthetic** — `border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px` for wobbly borders.
- **Responsive** — Mobile-first via `@media (max-width: ...)`.

### Supabase / Database Tables
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `students` | Users & auth | id, sr_code, password, name, avatar_url, role, email, enrollment_status, last_login, birthday, full_name |
| `schedule` | Class timetable | id, subject_code, subject_name, start_time, end_time, day_of_week, instructor, room, meet_link, classroom_link |
| `assignments` | Homework | id, title, subject, description, due_date |
| `events` | Calendar events | id, title, event_date, description |
| `shared_files` | Resources & receipts | id, title, subject, file_url, file_type |
| `notes` | Sticky notes, chat, comments, announcements | id, content, x_pos, y_pos, rotation, color, likes, created_at |
| `messages` | 1:1 chat | id, sender_id, receiver_id, content, created_at, is_read |
| `requests` | Anonymous admin inbox | id, content, sender, created_at |
| other tables | Games, profiles, etc. | (see `web2.html` inline code) |

### Key Patterns
- **Session** — `localStorage.getItem('wimpy_user')` or `sessionStorage.getItem('wimpy_user')`
- **Supabase client** — `window.db` (created from config in `common.js`)
- **Current user** — `window.user` object with { id, name, sr_code, avatar_url, role, ... }
- **Admin check** — `window.isAdmin` boolean
- **Permission check** — `hasPermission(toolName)` from `common.js`
- **Toast notifications** — `showToast(message, type)` with `type = 'info' | 'error'`
- **Confirm dialogs** — `await showWimpyConfirm(message)` returns boolean

### Linting
- ESLint: `npx eslint js/**`
- Formatting: `npx prettier --write .`
