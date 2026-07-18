# Database Schema

## Supabase PostgreSQL Tables

### `students`
User credentials and profile data.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `sr_code` | text | Student ID / username. `'ADMIN'` for main admin |
| `password` | text | Plaintext (no hashing — known limitation) |
| `name` | text | Display name |
| `full_name` | text | Full name (collected on first login) |
| `email` | text | Auto-generated or user-provided |
| `avatar_url` | text | Supabase storage URL |
| `last_login` | timestamp | Tracked for "Recently Spotted" |
| `role` | text | `'student'`, `'admin'`, or `'admin:tools:...'` (granular) |

**Queries used:** `select`, `insert`, `update`, `delete` by `id`, `sr_code`, or `name`

### `schedule`
Weekly class timetable.

| Column | Type | Notes |
|--------|------|-------|
| `id` | (inferred: int/uuid) | Primary key |
| `subject_code` | text | e.g., `CS101` |
| `subject_name` | text | Full subject name |
| `start_time` | time/timestamp | Class start |
| `end_time` | time/timestamp | Class end |
| `day_of_week` | text | e.g., `Monday` |
| `instructor` | text | Professor name |
| `room` | text | Room number/location |
| `meet_link` | text | Google Meet link |
| `classroom_link` | text | Google Classroom link |

**Queries used:** `select` (ordered by `start_time`), `insert`, `update`, `delete`, `delete all` (reset)

### `assignments`
Homework tracking.

| Column | Type | Notes |
|--------|------|-------|
| `id` | (inferred) | Primary key |
| `title` | text | Assignment title |
| `subject` | text | Subject name |
| `description` | text | Details |
| `due_date` | date/timestamp | Deadline |

**Queries used:** `select`, `insert`, `delete`

### `events`
Calendar events.

| Column | Type | Notes |
|--------|------|-------|
| `id` | (inferred) | Primary key |
| `title` | text | Event name |
| `event_date` | date | Date of event |
| `description` | text | Optional details |

**Queries used:** `select`, `insert`, `delete`

### `shared_files`
Uploaded resources and receipts.

| Column | Type | Notes |
|--------|------|-------|
| `id` | (inferred) | Primary key |
| `title` | text | Display name |
| `subject` | text | Category. Also stores `'Receipt-{studentId}'` |
| `file_url` | text | Supabase storage public URL |
| `file_type` | text | MIME type or category |
| `created_at` | timestamp | Auto-generated |

**Queries used:** `select`, `insert`, `delete` (by `id` or `subject` pattern)

### `notes`
Multi-purpose table — sticky notes, announcements, comments, chat, wordle, etc.

| Column | Type | Notes |
|--------|------|-------|
| `id` | (inferred) | Primary key |
| `content` | text | The actual content/text |
| `x_pos` | int | Reused for announcement **duration (minutes)** |
| `y_pos` | int | Position (sticky notes) or 0 |
| `rotation` | int | Visual rotation degrees |
| `color` | text | **Determines the type of note** (see special values below) |
| `likes` | int | Like counter |
| `created_at` | timestamp | Auto-generated |

**Special `color` values:**

| Value | Purpose |
|-------|---------|
| `'GLOBAL_MSG'` | Global announcement (broadcast) — content is the message, `x_pos` is duration in minutes |
| `'COMMENT:{id}'` | Comment on announcement `{id}` — content is `"sender:::message"` |
| `'WORDLE_WORD'` | Daily Wordle word — content is the word |
| `'CHAT_HIDDEN'` | Hidden/deleted group chat message |
| *(any other)* | Regular sticky note on the freedom wall — `x_pos`, `y_pos`, `rotation` for positioning |

**Queries used:** `select` (by `color`, ordered by `created_at`), `insert`, `update` (position, likes, content), `delete` (by `id` or `color` pattern)

### `messages`
Peer-to-peer messaging.

| Column | Type | Notes |
|--------|------|-------|
| `id` | (inferred) | Primary key |
| `sender_id` | uuid | References `students.id` |
| `receiver_id` | uuid | References `students.id` |
| `content` | text | Message body |
| `created_at` | timestamp | Auto-generated |
| `is_read` | bool | Read receipt |

**Queries used:** `select` (by sender/receiver, ordered by `created_at`), `insert`, `update` (`is_read`), `delete` (by `id` or older than date)

### `requests`
Anonymous messages to admin ("Message the Boss").

| Column | Type | Notes |
|--------|------|-------|
| `id` | (inferred) | Primary key |
| `content` | text | Message body |
| `sender` | text | Optional sender identifier |
| `created_at` | timestamp | Auto-generated |

**Queries used:** `select` (ordered by `created_at`), `insert`, `delete`

### `user_statuses`
Online presence tracking.

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | uuid | References `students.id` |
| `status` | text | e.g., `'online'`, `'offline'` |

**Queries used:** `upsert`, `select` (by `user_id`)

### `flashcards`
(Used in file-manager.js — needs further investigation)

| Column | Type | Notes |
|--------|------|-------|

### `global_todos`
(Used in file-manager.js — needs further investigation)

| Column | Type | Notes |
|--------|------|-------|

### `todo_completions`
(Used in file-manager.js — needs further investigation)

| Column | Type | Notes |
|--------|------|-------|

---

## Storage Buckets

| Bucket | Purpose | Visibility |
|--------|---------|------------|
| `avatars` | Profile pictures | Public |
| `class-resources` | Shared files, receipts, uploads | Public |

---

## Realtime

Enabled for the following tables (via Supabase Realtime):
- `notes` — freedom wall updates, announcements, comments
- `messages` — live chat

Realtime channel name: `'room-1'`
Events used: `announcement`, `comment`, `delete_announcement`, `hamilaw`, `system_reload`

---

## Supabase Connection

```js
// config.js
window.APP_CONFIG = {
    SUPABASE_URL: 'https://egnyblflgppsosunnilq.supabase.co',
    SUPABASE_KEY: 'eyJhbGciOi...',
};
```

Client initialized in `common.js`:
```js
window.db = supabase.createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_KEY);
```
