# Sistema ni JV — Full UI Rehaul Brief for Google Stitch

> **Purpose:** Feed this file directly into Google Stitch (paste sections as prompts) to regenerate the entire frontend UI from scratch.
> **App:** `Sistema ni JV / The Wimpy Credentials Book` — a real-time classroom companion for BSIT students: schedules, homework, events, files, messaging, freedom wall, games, admin tools.
> **Rehaul scope:** 100% visual redesign. Functionality, Supabase schema, and JS logic stay identical. Only HTML structure + CSS change.
> **Current stack:** Vanilla HTML/CSS/JS static site (`index.html` = auth + landing, `web2.html` = main binder dashboard), Supabase backend, Font Awesome 6.5.2, Outfit font.

---

## 0. How to Use This Doc in Stitch

1. **Start a new Stitch project:** Desktop-first, responsive. Set canvas to `1440px` desktop + `390px` mobile.
2. **Step 1 — Paste Section 4 + 5** as your first prompt ("Design system / tokens"). Generate the theme + component kit first.
3. **Step 2 — Paste one prompt at a time from Section 13** (Screen 01, 02, 03…). Generate screen-by-screen. Do not generate all screens in one go.
4. **Step 3 — For each screen, ask Stitch:** "Make it responsive for mobile 390px, keep same components, stack vertically, tabs become bottom nav."
5. Export as HTML/CSS and map classes back per Section 14.

> Stitch tip: always append to every prompt: `Use Outfit font only. Use Font Awesome icons only, no emojis. Clean modern education style, light theme with dark sidebar option. Rounded 10-14px cards, subtle shadows, tabular numbers.`

---

## 1. Product Snapshot

| Item | Detail |
|------|--------|
| **Name** | Sistema ni JV |
| **Tagline** | "Ako na bahala sa enrollment niyo guys." |
| **Users** | ~30-60 college students (BSIT-3106 + other blocks) + 2-5 admins |
| **Pages** | `index.html` (Auth + Campus Bulletin landing), `web2.html` (Binder dashboard, 8 tabs) |
| **Core jobs** | Check today's classes, see what's happening now, submit/read homework, download reviewers, chat with classmates, post on freedom wall, play games during breaks |
| **Admin jobs** | Post announcements, manage schedule/homework/events/files, manage blocks/sections, promote/demote co-admins, monitor storage, manage gallery |
| **Realtime** | Announcements, group chat, DMs, freedom wall notes, presence ("online classmates"), force-update broadcasts |
| **Tone** | Friendly Filipino classroom ("kosa", "mga kosa"), encouraging, never corporate-cold |

---

## 2. Rehaul Goals & Non-Goals

### Goals (what Stitch must achieve)
1. **Night-desk ledger, not generic SaaS.** Subject: the shared class binder left open on a dorm desk at 11pm. Audience: BSIT-3106 barkada on phones. Keep the dark desk surround as a frame (paper pops at night), a single red margin rule, and rubber-stamp status marks. Everything else quiet. Never Linear/Notion-clone.
2. **One coherent shell.** Today `index.html` and `web2.html` look like different apps. Rehaul unifies them: same top bar, same cards, same buttons, same radius/shadow/typography.
3. **Mobile-first usability.** 70%+ students are on phones. Old tabs overflow, modals clip, tables break. New UI must work at 390px with bottom nav / horizontally scrollable tabs.
4. **Scannability.** Schedule, homework, files must be glanceable in <3 seconds: clear hierarchy, status pills (Happening Now / Next / Overdue), strong empty states.
5. **Component consistency.** Replace ~40 ad-hoc card styles with ~12 reusable components (Section 8).

### Non-Goals (Stitch must NOT change)
- No DB schema changes, no new tables/columns.
- No auth logic changes (`wimpy_user` session key, SR-code + password).
- No ID renames — all `id="..."` in Section 3 must stay in the DOM.
- No emojis — Font Awesome icons only.
- No framework — Stitch output must be portable to vanilla HTML/CSS (no Tailwind dependency, no React).

---

## 3. Functional Constraints — MUST KEEP (Critical for Dev Handoff)

Stitch must generate UI that preserves these hooks. If an element is restyled, its `id` / `class` hook stays.

### 3.1 Preserved element IDs (do not rename/delete)
```
Auth (index.html):
#authSection, #loginUI, #authForm, #name, #srCode, #password, #togglePassword,
#keepLoggedIn, #submitBtn, #toggleAuth, #formTitle, #authModeMessage,
#adminLandingControls, #adminSection, #adminList, #coAdminSection, #coAdminList,
#publicMemberList, #memberCountBadge, #recentLoginsList, #allSpottedList, #spottedBtnText,
#newUpdatesSection, #newUpdatesList, #wimpyGallerySection, #wimpyGalleryContainer,
#adminDashboard, #adminNameDisplay, #searchInput, #autocompleteDropdown, #studentListContainer,
#adminRequestsList, #adminFileList, #adminChoiceModal, #studentDashboard,
#freedomWallModal, #freedom-wall-board, #fw-landing-input, #fw-landing-color,
#classListModal, #enrolled-list, #not-enrolled-list, #count-in, #count-out,
#nameCollectorModal, #collector-full-name, #floating-chip-bar, #toast-container

Binder (web2.html):
#class-countdown-pill, #pill-text, .binder, .sidebar, .nav-tabs,
.paper-content, .student-desk-bar, #userAvatarDisplay, #welcome-msg,
#user-section-badge, #user-section-name, #enrollment-badge, #user-status-text,
#recent-announcements-panel, #announcements-list, #live-clock, #gc-badge, #msg-badge,
#active-users-list, #live-class-container,
#admin-tools (+ all #admin-*-form), #schedule, #schedule-list, #schedule-section-filter,
#active-section-display, #current-day-label, #assignments, #assignment-list, #todo-list,
#calendar, #calendar-root, #links, #file-search, #subject-folder-grid, #file-list, #file-filter-label,
#flashcards, #flashcard-list, #fc-topic, #fc-link, #fc-desc, #help, #games, #game-title
```

### 3.2 Preserved JS classes (Stitch can restyle, not remove)
`.tab-btn.active`, `.tab-content.hidden`, `.admin-only.hidden`, `.sketch-btn`, `.btn-primary`, `.btn-secondary`, `.sketch-box`, `.card`, `.class-card`, `.wimpy-modal-overlay.hidden`, `.wimpy-modal-box`, `.toast`, `.slide-toggle`, `.input-accent`, `.ann-mini-card`, `.member-tags`, `.avatar-stack`, `.file-grid`, `.grid-container`, `.filter-bar`

### 3.3 Global rules
- Vanilla HTML/CSS only. No build step. Stitch CSS must use CSS variables, Flexbox/Grid.
- Icons: Font Awesome 6.5.2 `<i class="fas fa-...">` only. **Zero unicode emojis.**
- Fonts: `Outfit` for everything (300-800 weights). Tabular numbers for clocks/timers: `font-variant-numeric: tabular-nums`.
- All user-injected text is escaped via `escapeHTML()` — design must assume long names, long file titles, wrap/ellipsis gracefully.
- Toasts via `showToast(msg, 'info'|'success'|'error')`; confirms via `showWimpyConfirm()`.

---

## 4. New Visual Direction — "Night-Desk Ledger" (distinctive, not templated)

**Subject pinned:** The shared class binder left open on a dorm desk at 11pm. Audience: BSIT-3106 barkada on phones. Single job: answer "what's now, what's next, what do I owe" in under 10 seconds.
**One-line direction for Stitch:**
> Night-desk ledger: cool wash surround `#E9EDF3`, white paper sheets, midnight Ledger Ink text, one scholastic Marker Blue for action only, one Margin Red for the ledger rule + live stamps only, Highlighter yellow for active-day only. Outfit 800 tight display + 11px tracked eyebrows + tabular data. Quiet everywhere except one signature: the Living Margin.

**Signature (spend boldness here): the Living Margin.** A single 1px Margin Red vertical rule threads down the binder paper at ~148px on desktop with faint time ticks. Only the live-class card is allowed to break across it, stamped `HAPPENING NOW` in outlined red caps. It encodes time/order truthfully — not decoration. No numbered 01/02/03 markers (content is not sequential).

**Aesthetic risk (justified): keep the dark desk frame.** Most study apps are all-light. Ours keeps the `#0F172A` dotted night-desk surround so the white paper pops the way it does under a dorm lamp. This is specific to night checking behavior and preserves binder identity without kitsch.

### 4.1 What changes vs. old UI
| Old (remove) | New (generate) |
|---|---|
| Rainbow tab buttons (red/blue/green/amber/purple) | Unified divider-ear tabs: neutral `#F1F5F9`, active white with blue edge marker; admin tab ink |
| Hard `3px 3px 0 #000` offset shadows, 2px ink borders everywhere | 1px `slate-200` borders, soft shadows, 4px subject edge bar on cards |
| Glassy gradient online pill, checkerboard heaviness | Quiet `#F8FAFC` ledger row: eyebrow label + avatar stack + presence dots |
| Toasts yellow with hard shadow, wavy underline titles | Ink toasts (red only for error), tight display titles, eyebrow labels with rule |
| Floating chip bar with tri-color hovers | Single dark pill bar, white text, subtle hover wash |
| Tape/pins/rings/checkerboard, sketchy radii | None except margin rule + stamps. Radii `10/12/16/999px` only |

### 4.2 What we deliberately avoid (generic defaults)
No warm cream `#F4F1EA` + serif + terracotta. No near-black + acid green. No broadsheet hairlines/zero-radius. No Linear-clone all-light SaaS. No Duolingo rainbow. If Stitch proposes any of these, reject and return to Night-Desk Ledger tokens.

---

## 5. Design Tokens (Generate Exactly These)

### 5.1 Colors — 6 named jobs (strict: no off-palette accents)
```css
:root {
  --ledger-ink: #0F172A;      /* Ledger Ink — text, sidebar, primary buttons */
  --ledger-wash: #E9EDF3;     /* Desk Wash — app surround (cool, not cream) */
  --paper: #FFFFFF;           /* Paper — sheets/cards */
  --marker-blue: #1D4ED8;     /* Marker Blue — ACTION ONLY: links, active tab edge, focus ring, Meet */
  --margin-red: #E02D3C;      /* Margin Red — MARGIN RULE + live/urgent/overdue stamps ONLY */
  --highlighter: #FFF284;     /* Highlighter — active-day + todo wash ONLY */
  --presence: #12A56F;        /* Presence Green — online dot ONLY */
  --ink-muted: #64748B;       /* eyebrows/meta */
  --border: #E2E8F0;
}
```
Strict jobs prevent rainbow drift: red never decorates, blue never fills backgrounds, yellow never highlights body text, green never means success elsewhere. Subject tints derive from Marker Blue at 12% steps, not 6 hues.

### 5.2 Typography — Outfit only (repo constraint; character via contrast, not new faces)
| Role | Spec | Use |
|------|------|-----|
| Display | Outfit 800, 28-32px, -0.035em, sentence case | Page titles ("Class schedule", "To do list") |
| Eyebrow | Outfit 700, 11px, +0.14em uppercase, slate-500 + 18px rule | Section labels ("Online classmates", "Happening now") — the memorable type moment |
| H2 / Card | Outfit 700, 20-22px, -0.02em | Card + modal titles |
| Body | Outfit 400-500, 14-15px, 1.55 lh | Paragraphs, rows |
| Data | Outfit 600-700 + `tabular-nums` | Clocks, countdowns, SR codes (as `.sr-code` uppercase chips) |
| Stamp | Outfit 800, 11px, +0.14em uppercase, outlined red | `HAPPENING NOW`, `ENROLLED`, `OVERDUE` only |

No cursive, no marker, no handwriting faces. SR codes render as tracked uppercase chips, not mono (keeps Outfit-only rule).

### 5.3 Spacing (8pt grid)
`4 / 8 / 12 / 16 / 20 / 24 / 32 / 48px`. Card padding: `20-24px` desktop, `16px` mobile. Page max-width: `1200px`, content gutter `24px` desktop / `16px` mobile.

### 5.4 Radius + Shadows + Borders
```css
--radius-sm: 8px;   /* pills, badges, inputs */
--radius-md: 12px;  /* buttons, small cards */
--radius-lg: 16px;  /* main cards, modals */
--radius-xl: 20px;  /* hero / gallery cards */
--radius-full: 999px;

--shadow-sm: 0 1px 2px rgba(15,23,42,.05);
--shadow-md: 0 4px 12px rgba(15,23,42,.07);
--shadow-lg: 0 12px 32px rgba(15,23,42,.12);
--shadow-pop: 0 20px 60px rgba(15,23,42,.20); /* modals only */

--border-card: 1px solid var(--border);
```

### 5.5 Motion
- Fast `160ms`, base `220ms`, slow `350ms`, curve `cubic-bezier(0.23,1,0.32,1)`.
- Only animate `transform` + `opacity`. Buttons `scale(0.97)` on press. Cards lift `translateY(-2px)` + shadow on hover (desktop only, gated behind `@media (hover:hover)`).
- Live pulse: 2px dot + expanding ring for "Happening Now" / online dot. Respect `prefers-reduced-motion`.

---

## 6. Information Architecture & Shell

### 6.1 Sitemap
```
index.html (Public)
├── Auth card (Login / Register toggle)
├── Campus Bulletin column (Hi Classmates / Just Spotted / Fresh Drops)
├── Memories gallery strip
├── Freedom Wall modal
├── Class List modal (Enrolled / Not Enrolled)
└── Admin: Black List dashboard + Admin Choice modal

web2.html (Authed — Binder)
├── Sticky top bar: logo, block switcher, search, group-chat btn + badge, inbox btn + badge, clock, avatar menu (Wide, Admin, Go Home)
├── Live class banner (conditional) + countdown pill (sticky)
├── Online classmates avatar stack
├── Tabs: Schedule | To Do | Events | Files | Flashcards | Help | Games | Admin Tools (admin only)
└── Overlays: Group chat drawer, DM inbox modal, File preview modal, Announcement popup, Wallpaper modal, PDF scanner modal, Request modal
```

### 6.2 New unified shell (what Stitch generates)
- **Desktop ≥1024px:** Left dark icon sidebar (logo at top, 8 nav items with icons + labels, admin section pinned at bottom, user card at very bottom) + right content area with sticky white top bar (page title, block pill, search, clock chip, chat/inbox icon buttons with badges, avatar). Content max 1200px, 24px padding.
- **Tablet 768-1023px:** Collapsed icon-only sidebar (64px) + same top bar.
- **Mobile <768px:** No sidebar. Sticky top bar (logo + clock + avatar + chat/inbox) + horizontally scrollable pill tabs under it + bottom nav (Schedule, To Do, Files, Chat, More). All grids single-column. Modals full-sheet bottom.
- **Admin Tools tab** keeps its sub-tool button bar but redesign as segmented icon grid (12 tools), active tool opens as a focused card with Close button.

---

## 7. Screen-by-Screen Specs (Stitch Must Cover All)

### SCREEN 01 — Auth / Landing (`index.html`, logged-out)
**Goal:** Login in <10s, but show campus life to entice.
**Layout (desktop 2-col, 1180px max):**
- Left card (420px): logo (48px rounded), `Sistema ni JV` display title, subtitle, tabs or toggle `Login | Register`. Fields: SR Code, Password (eye toggle), [Register-only: Full Name]. Checkbox `Keep me logged in` + `ENTER →` full-width blue button. Toggle link `Magpapalista? Come here mga kosa`. Below: Main Admin + Co-Admins avatar chips (collapsible). Footer: `Developed by Jv Bitancor` + Facebook/GitHub icons.
- Right column (flex-1): `Class Bulletin & Activity` card with 3 quick chips (Updates / Wall / Roster). Stacked sections: `Hi Classmates` (searchable chip cloud + count badge), `Just Spotted` (avatar + name + timeAgo rows + View Full History expander), `Fresh Drops` (file rows: icon by type, title, subject pill, time). Below: `Memories` horizontal snap carousel (polaroid cards, caption overlay, admin Add Photo button if admin).
**States:** loading skeletons for lists; empty ("No classmates yet — be the first!"); error toast; password show/hide; register reveals name field.
**Mobile:** single column, auth card first, bulletin second, gallery third. Sticky `ENTER` button safe-area aware.

### SCREEN 02 — Admin Choice + Black List (`index.html`, admin logged-in)
- **Choice modal:** centered 400px card, shield icon, `ADMIN ACCESS GRANTED`, two big buttons: `Manage Users (Black List)` + `Go to Binder (As Admin)`, note about binder powers.
- **Black List dashboard:** full-width (max 1100px) admin console. Header: `THE BLACK LIST` + subtitle. Info bar: current admin + actions (Refresh, Portal, Menu, Exit). Search input with autocomplete dropdown. Student rows: avatar, name, SR-code, status pill (enrolled/not), role badge, actions (view, login-as, promote, delete). Below: 3-col tool grid (Inbox requests list, Upload to Memories form, Manage Files list). Wide-mode toggle expands to 1400px.
**Stitch note:** design as a proper admin console table → cards on mobile, not a notebook page.

### SCREEN 03 — Binder Top Bar + Home Context (`web2.html` shell, all tabs)
- Top bar (sticky, blur): left = mini logo + `Sistema ni JV` + block pill (`BSIT-3106`, dropdown to switch). Center = page title per tab. Right = live clock chip (`TIME CHECK 14:32`, tabular), icon buttons (group chat with `!` badge, inbox with count badge), avatar with dropdown (Edit name, Edit status, Change photo, Go Home).
- Below top bar: conditional **Live class banner** (blue gradient card: pulsing red dot + `HAPPENING NOW: IT 211 — Web Systems`, room, instructor, time remaining progress bar, buttons `Join Meet` + `Classroom`). If no live class: slim **countdown pill** (`Next: CS 101 in 42m →`, clickable).
- Below: `ONLINE CLASSMATES` avatar stack (overlapping 32px circles, +N overflow, green dot, tooltip name, click → DM).
- Bulletin strip: `Bulletin` card with announcement mini-cards (title, excerpt, timer progress bar + `12m left` label, comment count, click → popup). Admin `+` quick-add button.

### SCREEN 04 — Schedule Tab (most-used)
- Header: `Class Schedule` + block switcher select + day filter pills (Mon-Sat + All, active = dark pill) + actions (Wallpaper, Paste Schedule [admin], Delete [admin]).
- Badge: `Showing Schedule for Block: BSIT-3106`.
- List: timeline cards grouped by day. Each class card: left color bar by subject, code + name (e.g., `IT 211 — Web Systems`), meta row (time `09:00–10:30` tabular, room, instructor), link buttons (Meet / Classroom icons), live state (if now: red `HAPPENING NOW` pulse + highlighted border), admin kebab (edit/delete). Past classes dimmed to 60%.
- Empty: illustration + `No classes for Saturday — rest day!` + admin CTA `Add class`.
- Extras: Wallpaper modal (preview phone/desktop mockups, Glassmorphism toggle, Download via html2canvas), PDF scanner modal (paste area + parsed preview table + import).

### SCREEN 05 — To Do List Tab
- Two sections: `Homework Assignments` (cards: title, subject pill, due date + overdue red / due-soon amber / upcoming neutral, description clamp, admin delete) + `Class To-Do List` (yellow-tinted cards: checkbox → avatar stack of completers, progress `12/30 done`, encouraging note banner `Mark when done! Classmates will see you finished it.`).
- Sort: overdue first, then nearest due. Include filter (All / Mine / Overdue).

### SCREEN 06 — Events Calendar Tab
- Month grid (Mon-Sun header, today ring, event dots, selected day highlight) + side agenda list for selected day (event cards: date badge, title, description, admin delete). Admin quick-add (title + date + desc) via inline form or `+` on day click. Mobile: calendar on top, agenda below. Include mini birthdays strip if data present.

### SCREEN 07 — Files Tab (Resource Cabinet)
- Top: two Drive promo cards (Meet Recordings, Topology Recording → `OPEN DRIVE` buttons).
- Search input (`Search filename...`) + subject folder grid (colorful folder cards with counts: All, General, each subject from schedule).
- File grid: file cards (type icon: PDF red, image green, doc blue, video purple; title ellipsis 2 lines; subject pill; uploader + timeAgo; actions: Preview, Download, Delete [admin]). Click → preview modal (PDF.js / image / video player, title bar, download button).
- Bottom: External Tools row (Old Archive, Secret Request → anonymous modal, Post to Freedom Wall).
- Empty: `No files in [subject] yet.` + upload CTA (admin).

### SCREEN 08 — Flashcards Tab
- Intro line + admin-only add form (Topic, Link URL, Description, `Save Flashcard Set`).
- List: flashcard set cards (topic title, domain badge auto from URL: Quizlet/Anki/Drive, description, `Open Deck →` button, added date, admin delete). Auto-expire note (`Links auto-remove after 7 days`).

### SCREEN 09 — Help Guide Tab
- 6-card grid: The Binder, Messaging, File Previewer, Wallpaper Gen, Live Tracker, Secret Requests — each with icon, title, 2-line explainer, optional `Try it →` deep link. Search box filters cards.

### SCREEN 10 — Games Tab (Arcade)
- Header: highlighted `GAME ARCADE` title card + game switcher pills (Wordle / Minesweeper / Creature Battle).
- Wordle: 6×5 grid, keyboard, shake on invalid, flip on reveal, win/lose toast + streak.
- Minesweeper: difficulty select, grid, flag counter, timer, win/lose overlay.
- Creature Battle: deck select → battle arena (player vs AI cards, HP bars, countdown timer, clash burst animation, win increments `battle_wins`).
- Leaderboard strip (most wins) below arena.

### SCREEN 11 — Messaging (DM Inbox Modal + Group Chat Drawer)
- **DM modal:** left conversation list (avatar, name, last message preview, unread dot, timeAgo, search), right thread (bubbles: mine blue-right, theirs gray-left, read receipt checkmarks, date dividers), composer (input + send, Enter to send), actions (delete message, clear chat with confirm).
- **Group chat drawer:** right slide-over 380px (full-screen on mobile). Header (class name + online count + close). Message stream (avatar + name + bubble + reaction row + timestamp). Typing indicator (`Juan is typing...`). Composer + emoji-free reaction picker (Font Awesome). Hidden/deleted messages show `Message removed`.
- Badges sync: inbox count + `!` dot update in top bar.

### SCREEN 12 — Freedom Wall (Modal + Board)
- Modal 720px: header (`FREEDOM WALL` + online count + Close + admin Auto Arrange / Scatter), board area (masonry/draggable sticky notes: yellow/pink/blue/green/white, rotation -3° to 3°, author + timeAgo, like button, admin delete), color picker row, composer (`Write on the wall...` + `STICK IT` button, 60 char limit). Drag to move (desktop), tap to focus. Realtime insert animation (scale 0.95→1 + fade).

### SCREEN 13 — Class List + Misc Modals
- Class List modal: header + Refresh + Close, note `Enrollment status — check with admin`, two columns: Enrolled (green, count) / Not Enrolled (gray, count), member chips.
- Request modal (Secret Request): textarea + Send/Cancel.
- Name Collector modal (first login): `IDENTIFICATION REQUIRED`, full-name input, `SAVE & CONTINUE →`.
- Announcement popup: full overlay, message card, duration timer bar, comment thread + composer, Close.
- Confirm dialog + Toast stack (top-right, auto-dismiss, success green / error red / info dark).

### SCREEN 14 — Admin Tools Tab (Binder)
- Sub-tool nav: icon grid (Class, Homework, Event, File, To-Do, Email, Messages, Gallery, Birthdays, Storage, Blocks/Sections, Privileges, Announcement [main-admin], Force Update, Revoke). Active tool card opens centered with Close.
- Key forms: Add Class (section select, day, code, name, start/end time, room, instructor, Meet/Classroom links); Upload Resource (title, subject select auto from schedule, file picker); Email Center (recipient select All/specific, subject, body, Import Homework button); Blocks manager (assign student → block, clone schedule source→target, grouped roster); Privileges (user select + tool checkboxes grid); Storage Monitor (Scan Buckets → bucket bars + MB/GB); Message Manager (Refresh + Clear Old); Gallery Manager; Birthday Viewer.

---

## 8. Component Library (Ask Stitch to Generate These as Reusable)

1. **App Button:** variants Primary (blue solid), Secondary (white + border), Danger (red soft + red text), Ghost (text only), Icon-only (40px circle). Sizes sm/md/lg. Press scale 0.97.
2. **Pill Tabs + Day Pills:** neutral pill, active dark/blue, horizontally scrollable on mobile, `overflow-x:auto`, `scrollbar-width:none`.
3. **Cards:** Base card (white, 1px border, 12-16px radius, sm shadow), Highlight card (blue wash for live), Note card (yellow tint + slight rotate for To-Do/Wall), Promo card (Drive blue/purple gradient wash).
4. **Inputs:** text/select/textarea/datetime/file — 12px radius, 1px border, focus ring `2px accent-soft + 1px accent`, error red ring. Underline-only inputs are banned (old `.input-accent` retired).
5. **Badges/Pills:** Status (Happening Now red pulse, Next blue, Overdue red, Due Soon amber, Enrolled green, Not Enrolled gray), Count badge (blue circle), Subject pill (tinted per subject color).
6. **Avatars:** 32/40/48px circles, ring-2 white, overlap stack +N, green presence dot, fallback initials.
7. **Lists/Rows:** roster row, file row, message row — 12px padding, hover wash, divider `1px border`.
8. **Modal/Sheet/Drawer/Popover:** modal centered max 560px (720px for Wall), bottom-sheet on mobile, right drawer for group chat, overlay `rgba(15,23,42,.5) + blur(4px)`, entrance `translateY(8px)+fade`.
9. **Toast + Confirm:** toast top-right stack, icon + message + close; confirm centered with danger primary.
10. **Empty/Loading/Error:** empty (icon in soft circle + title + hint + CTA), skeleton shimmer rows/cards, error (red icon + retry).
11. **Calendar Cell + Event Card + Timer Bar:** month cell (number, dot stack, today ring), agenda card, 4px progress bar (blue → amber <5m → red <2m).
12. **File/Folder/Game Cards:** folder card (icon + name + count), file card (type icon + meta + actions), game cards per Section 7.

---

## 9. Interaction, Motion & Realtime States

- **Live pulse:** `HAPPENING NOW` dot + `ONLINE` dots pulse 1.6s. Countdown pill updates every 30s (`Next: X in Nm`), banner progress bar fills as class elapses.
- **Optimistic UI:** chat send, wall post, todo check apply instantly, rollback on error with error toast.
- **Realtime inserts:** new announcement → slide-down banner + bulletin prepend; new chat → auto-scroll if pinned to bottom, else `New messages ↓` pill; new wall note → pop-in.
- **Confirm before destroy:** delete class/file/homework/event/message, clear old messages, revoke admin, delete schedules — always `showWimpyConfirm`.
- **File upload:** progress bar on button (`Uploading 42%...`, disabled), success toast + list prepend.
- **Presence:** heartbeat every 60s, avatar stack re-sorts, `Just Spotted` uses `timeAgo`.
- **Reduced motion:** disable pulse/drag animations when `prefers-reduced-motion`.

---

## 10. Responsive Spec (Stitch Must Output All Three)

| Breakpoint | Layout |
|---|---|
| **Mobile 390px** | Single col, 16px gutters. Top bar compact (logo, clock chip, chat/inbox icons, avatar). Scrollable pill tabs. Cards full-width. Calendar 7-col mini. Modals = bottom sheets (rounded top 20px, drag handle). Bottom nav: Schedule, To Do, Files, Chat, More. FAB for quick chat. Tables → cards. |
| **Tablet 768px** | 2-col grids for schedule/files/help. Icon-only sidebar 64px if binder. Modals centered 90vw. |
| **Desktop 1280px** | Sidebar 240px + content 1200px max. 3-col grids. Gallery 4-up. Hover lifts on. Ambient decorations banned. |

Safe areas: `env(safe-area-inset-*)` on sticky bars/modals. Min touch target `44px`. Inputs `16px` font to prevent iOS zoom.

---

## 11. Accessibility Checklist for Stitch

- Semantic landmarks: `header/nav/main`, `h1` once per screen, labels for every input, `aria-label` on icon-only buttons, `role=dialog aria-modal` on modals with focus trap + Esc close + return focus.
- Contrast: text on bg ≥4.5:1 (slate-900 on white passes; secondary slate-500 only for meta ≥12px bold or 14px+).
- Keyboard: all tabs/modals/menus operable, visible focus ring (`2px solid var(--accent)`, offset 2px).
- Avatars `alt="{name}"`, decorative icons `aria-hidden="true"`.
- Live regions: `aria-live="polite"` on toast + chat stream + countdown.

---

## 12. Copy Tone & Sample Content (Use Verbatim in Mockups)

- Auth title: `Sistema ni JV` / subtitle: `Your class binder — schedule, files, and kosa updates in one place.`
- Register toggle: `Magpapalista? Come here mga kosa click this`
- Empty schedule: `No classes for Saturday — rest day!`
- To-Do banner: `Mark the task when done! Your classmates will see you finished it.`
- Class list note: `Enrollment status — check with admin`
- Profile default status: `Certified Member`
- Buttons: `ENTER →`, `STICK IT`, `OPEN DRIVE`, `SAVE & CONTINUE →`, `BROADCAST NOW`
- Use Filipino warmth sparingly (`kosa`, `mga kosa`), never meme-spam. No emojis in copy.

---

## 13. Copy-Paste Prompts for Stitch (Generate In This Order)

> Append to every prompt: `Outfit font, Font Awesome icons only (no emojis), light theme #F1F5F9 bg + white cards, 12-16px radii, subtle shadows, tabular numbers, responsive to 390px mobile.`

**PROMPT 01 — Design system kit:**
`Generate a reusable UI kit for a college class companion app "Sistema ni JV": color tokens (slate text, blue #2563EB accent, success/warning/danger + soft washes, 6 subject tints), Outfit typography scale, buttons (primary/secondary/danger/ghost/icon), inputs/selects/textarea/file, badges (live pulse, overdue, enrolled), avatars + overlap stack, cards, modal/drawer/toast/confirm, empty/loading skeleton/error, calendar cell + timer bar. Show all on one page with usage notes.`

**PROMPT 02 — Auth landing (index.html):**
`Generate desktop + mobile for auth landing: left login/register card (logo, SR code, password with eye, keep-logged-in, ENTER button, admin/co-admin chips, credits) + right bulletin column (Hi Classmates chips + count, Just Spotted rows + history expander, Fresh Drops file rows) + Memories horizontal carousel. Include loading, empty, error states. Max 1180px, single-col on mobile.`

**PROMPT 03 — Binder shell + top bar:**
`Generate app shell for logged-in dashboard: dark left icon sidebar (Schedule, To Do, Events, Files, Flashcards, Help, Games, Admin Tools) + sticky white top bar (logo, block pill BSIT-3106, search, clock chip tabular, chat + inbox icon buttons with badges, avatar menu) + live class banner (HAPPENING NOW card with progress + Join Meet/Classroom) + countdown pill + online classmates avatar stack + bulletin strip with announcement mini-cards + timer bars. Desktop sidebar, mobile bottom nav + scrollable tabs.`

**PROMPT 04 — Schedule tab:**
`Generate schedule tab: day pills Mon-Sat+All, block switcher, actions (Wallpaper, Paste Schedule, Delete), timeline class cards (color bar, code+name, time/room/instructor tabular, Meet/Classroom buttons, Happening Now highlight, past dimmed, admin kebab), empty rest-day state, plus Wallpaper modal (phone/desktop preview + download) and PDF scanner modal (paste + preview table).`

**PROMPT 05 — To Do + Events:**
`Generate To Do tab (homework cards with due pills overdue/soon/upcoming + class To-Do yellow cards with checkboxes + completer avatars + progress) and Events month calendar (grid with dots + today ring, agenda list, admin add). Mobile stacked.`

**PROMPT 06 — Files + Flashcards + Help:**
`Generate Files tab (Drive promo cards, search, subject folder grid with counts, file cards with type icons + preview/download/delete, preview modal, External Tools row, empty state) + Flashcards tab (admin add form + deck cards with domain badges) + Help 6-card grid with search filter.`

**PROMPT 07 — Games + Messaging + Wall:**
`Generate Games arcade (switcher + Wordle grid + Minesweeper + Creature Battle arena with HP bars + leaderboard) + DM inbox modal (conversation list + thread + composer + read receipts) + group chat drawer (stream + reactions + typing indicator) + Freedom Wall modal (draggable sticky notes + color picker + composer + admin arrange/scatter). Mobile: drawer and modals become full-screen sheets.`

**PROMPT 08 — Admin console:**
`Generate admin console: Black List dashboard (info bar, search + autocomplete, student rows with status/role/actions, inbox/gallery/files grid) + Admin Choice modal + Binder Admin Tools grid (12 tool cards opening focused forms: class, homework, event, file, todo, email with import-homework, messages, gallery, birthdays, storage with usage bars, blocks clone/assign, privileges checkboxes, broadcast, revoke). Include confirms + toasts.`

---

## 14. Dev Handoff — Mapping Stitch Output Back to Repo

- Keep file split: `css/common.css` (tokens + kit), `css/auth.css` (landing), `css/dashboard.css` (binder), `css/games.css`, `css/group-chat.css`, `css/admin.css`. Stitch CSS variables map 1:1 to Section 5.
- Stitch must not rename IDs in Section 3.1. New decorative wrappers are allowed around them.
- Replace `.input-accent` (underline) with new input component, but keep the class name as an alias to avoid JS breakage.
- Retire sketchy radius/shadow vars but keep names as aliases: `--radius-sketchy: 8px; --shadow-offset: <soft sm>`.
- Verify after port: login → binder → each tab → chat → wall → admin tool → mobile 390px → keyboard-only pass → `npm run lint` + `format:check`.
- Ship as static HTML/CSS only — no Stitch React/Tailwind runtime.

---

## 15. What NOT to Generate (Stitch Guardrails)

- No unicode emojis anywhere. No comic/marker/handwriting fonts. No paper texture, tape, pins, binder rings, checkerboard backgrounds.
- No new colors outside Section 5 without approval. No hardcoded hex in components — always `var(--...)`.
- No dead buttons — every button in mockups must map to a real JS function in `context/prd.md`/`context/architecture.md`.
- No desktop-only designs — every screen ships with its 390px mobile variant.

---

*Generated from live repo audit (Oct 2026): `index.html` + `web2.html` + `css/*` + `js/*` + `context/*`. Feed Sections 4-5 + one Prompt from 13 per Stitch session for best results.*
