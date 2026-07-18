# AGENTS.md — Project Conventions

## Stack
- Vanilla HTML/CSS/JS (no framework, no bundler)
- Supabase (PostgreSQL, Auth, Realtime, Storage)
- CDNs: Supabase JS SDK, EmailJS, html2canvas, PDF.js, Google Fonts, FontAwesome
- Hosted as static site (GitHub Pages compatible)

## Script loading order
All pages: `config.js` → `common.js` → app-specific JS  
`config.js` exports `window.APP_CONFIG` with hardcoded Supabase creds.  
`common.js` reads those to create `window.db = supabase.createClient(...)`.  
Other JS files assume `window.db` is ready when they run.

## Entrypoints
| Page | Path | Key JS |
|------|------|--------|
| Auth & landing | `index.html` | `script.js` (2874 lines) |
| Main app (binder/dashboard) | `web2.html` | `dashboard.js`, + `admin.js`, `messaging.js`, `group-chat.js` |

## Key patterns
- No TypeScript — JSDoc `@param` / `@returns` for type hints
- Cross-file state lives on `window.*` — `window.user`, `window.db`, `window.isAdmin`
- Session: `localStorage` or `sessionStorage` key `wimpy_user`
- Permission check: `hasPermission(toolName)` from `common.js`
- User-facing errors: `showToast(msg, 'error')`; debugging: `console.error`
- Confirmations: `await showWimpyConfirm(message)` (returns boolean)
- CSS: sketchy aesthetic via `border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px`

## Developer commands
```bash
npm run lint          # npx eslint js/**/*.js  (ESLint v9 flat config)
npm run format        # npx prettier --write "js/**/*.js" "css/**/*.css" "*.html"
npm run format:check  # prettier check (no write)
```

No test framework or test scripts exist.

## Prettier config (`.prettierrc`)
`semi: true`, `singleQuote: true`, `tabWidth: 4`, `trailingComma: "all"`, `printWidth: 120`

## ESLint (flat config, `eslint.config.mjs`)
Warnings only. Key rules: `no-unused-vars`, `no-undef`, `prefer-const`, `no-var`, `eqeqeq`, `curly`.

## Database (Supabase)
Core tables: `students`, `schedule`, `assignments`, `events`, `shared_files`, `notes`, `messages`, `requests`.
Storage buckets: `avatars` (profile pics), `class-resources` (files/receipts).
Realtime enabled for: `messages`, `notes`.

## Notable quirks
- Script tags use cache-busting `?v=...` suffix — bump on deploy.
- `web2.html` has ~2887 lines with inline `<style>` blocks alongside linked CSS.
- `js/common.js` exports globals via plain `function` declarations (no IIFE/module wrapper).
- `js/config.js` contains plaintext Supabase anon key — treat as public but rotate if exposed.
- Assets `*.wav`, `*.pdf`, `assets/screenshots/` are gitignored.
