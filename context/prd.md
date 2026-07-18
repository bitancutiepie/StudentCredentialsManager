# Product Requirements

## Product

**Name:** Sistema ni JV / The Wimpy Credentials Book
**Tagline:** "Ako na ang bahala sa enrollment niyo guys."
**Description:** A classroom companion app for academic management — enrollment tracking, schedules, resources, and communication, wrapped in a hand-drawn sketchbook aesthetic.

---

## Personas

### Students
- View weekly class schedule with live "happening now" tracking
- Access assignments, deadlines, and shared resources
- Send and receive messages to/from classmates
- Participate in group chat
- Post sticky notes on the freedom wall
- Play games (Creature Battle, Minesweeper, Wordle)
- View calendar events
- Upload profile pictures

### Admins
- Everything a student can do
- Broadcast global announcements with timed expiration
- Manage schedule (add/edit/delete classes)
- Create assignments and calendar events
- Upload/manage class resources and receipts
- Promote/revoke user roles
- Impersonate students ("Login as User")
- Delete sticky notes and moderate content
- Manage the Wordle word of the day
- Access the blacklist dashboard (student management)
- View storage monitor

---

## Feature Inventory

### Authentication & Onboarding
| Feature | Description | File(s) |
|---------|-------------|---------|
| Login/Signup | SR code + password auth | `script.js`, `index.html` |
| Session persistence | "Keep me logged in" via localStorage/sessionStorage | `common.js` |
| Admin choice modal | Admin selects Blacklist or Binder on login | `script.js` |
| Name collection | First-time students prompted for full name | `script.js` |
| Avatar upload | Profile picture via Supabase storage | `dashboard.js` |

### Dashboard (The Binder)
| Feature | Description | File(s) |
|---------|-------------|---------|
| Schedule viewer | Weekly classes with day filters | `dashboard.js` |
| Live class pill | Pulsing "Happening Now" indicator | `dashboard.js`, `web2.html` |
| Countdown pill | "Next class in Xm" | `dashboard.js` |
| Interactive calendar | Monthly event view, admin can add events | `dashboard.js` |
| Assignments view | Homework list with deadlines | `dashboard.js` |
| Resource cabinet | File browser with smart filters (photos vs materials) | `dashboard.js` |
| Freedom wall | Draggable sticky notes with real-time sync | `script.js`, `dashboard.js` |
| Class list | Student roster | `script.js` |
| Profile viewer | User info, avatar, status | `dashboard.js` |

### Communication
| Feature | Description | File(s) |
|---------|-------------|---------|
| Bulletin announcements | Expiring global announcements with countdown timer | `dashboard.js`, `common.js`, `admin.js` |
| Announcement comments | Reactions/comments on announcements | `common.js` |
| Peer messaging | 1-on-1 chat with read receipts | `messaging.js` |
| Group chat | Real-time group chat with reactions | `group-chat.js` |
| Anonymous requests | "Message the Boss" — anonymous notes to admin | `dashboard.js`, `script.js` |

### Admin Tools
| Feature | Description | File(s) |
|---------|-------------|---------|
| Announcement broadcast | Send timed global popup announcements | `admin.js` |
| Schedule management | CRUD for classes | `admin.js`, `dashboard.js` |
| Assignment management | Create/delete homework | `admin.js` |
| Event management | Create/delete calendar events | `admin.js` |
| File management | Upload/delete resources and receipts | `admin.js`, `script.js` |
| Role management | Promote to admin, revoke access | `admin.js` |
| User impersonation | Login as any student | `admin.js` |
| Storage monitor | Supabase storage usage (MB/GB) | `admin.js` |
| Wordle admin | Set daily Wordle word | `admin.js` |
| Auto-cleanup | Delete expired announcements every 30s | `admin.js` |
| PDF schedule scanner | Parse class schedule from PDF | `pdf-scanner.js` |

### Games
| Feature | Description | File(s) |
|---------|-------------|---------|
| Creature Battle | Card-based battle game with AI, countdown timer | `creature-battle.js` |
| Minesweeper | Classic minesweeper with timer | `minesweeper.js` |
| Wordle | Daily word-guessing game | `wordle.js` |

### File Manager (standalone page-like feature)
| Feature | Description | File(s) |
|---------|-------------|---------|
| File browser | View/upload/delete files | `file-manager.js` |
| User status | Online/offline presence | `file-manager.js` |
| Schedule viewer | Lightweight schedule view | `file-manager.js` |
| Profile editor | Edit display name | `file-manager.js` |

---

## User Flows

### Student Flow
1. Open `index.html` → Login with SR code + password
2. Redirected to `web2.html` (The Binder)
3. See schedule, announcements, clock
4. Navigate tabs: Schedule → Assignments → Resources → Freedom Wall → Messages → Games → Help
5. Real-time updates for announcements, messages, and notes

### Admin Flow (Binder)
1. Login → Admin choice modal → Select "Binder"
2. Redirected to `web2.html` with additional "Admin Tools" tab
3. Access announcement broadcast, schedule CRUD, file management, etc.

### Admin Flow (Blacklist)
1. Login → Admin choice modal → Select "Black List"
2. Stays on `index.html` with expanded admin dashboard
3. Manage students, view receipts, storage monitor
