# 📓 The Wimpy Credentials Book (Sistema ni JV)

![Project Logo](logo.png)

![Project Status](https://img.shields.io/badge/Status-Active-success?style=for-the-badge)
![Tech Stack](https://img.shields.io/badge/Stack-HTML%20%7C%20JS%20%7C%20Supabase-blue?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-orange?style=for-the-badge)

> *"Ako na ang bahala sa enrollment niyo guys."*

**The Wimpy Credentials Book** is a personalized, web-based Student Companion Application designed to simplify academic management for a close-knit group of students. 

Diverging from sterile, corporate interfaces, this project adopts a **hand-drawn, sketchbook aesthetic** inspired by the *Diary of a Wimpy Kid* series. It combines nostalgic UI elements—like binder rings, tape, and doodles—with powerful real-time database functionality to manage schedules, resources, and student profiles.

---

## 📑 Table of Contents
- [✨ Key Features](#-key-features)
- [📸 Gallery](#-gallery)
- [🛠️ Tech Stack](#-tech-stack)
- [💾 Database Schema](#-database-schema)
- [🚀 Installation & Setup](#-installation--setup)
- [⚠️ Security Note](#-security-note)
- [🤝 Contributing](#-contributing)

---

## ✨ Key Features

### 🎓 Student Dashboard (The Binder)
*   **Dynamic Schedule:** Weekly class viewer with filtering by day.
*   **Live Class Tracker:** A pulsing "Happening Now" card appears automatically when a class is currently in session.
*   **Interactive Calendar:** Monthly view of events; Admins can click days to add events instantly.
*   **Digital Backpack:** Centralized access to homework assignments and deadlines.
*   **Resource Cabinet:** Organized file repository with **Smart Filters** (separating gallery photos from study materials) and **File Previews**.
*   **Help Guide:** A dedicated tab explaining how to navigate the system.
*   **Real-time Clock:** A retro Casio-style watch displaying the current time.

### 🔐 Authentication & Profiles
*   **Memories Gallery:** A "Diary of a Wimpy Kid" style photo gallery on the login page.
*   **Dual-Role Access:** Distinct flows for **Students** (Binder View) and **Admins** (Management View).
*   **Custom Avatars:** Users can upload profile pictures that are stored in the cloud.
*   **Session Management:** "Keep me logged in" functionality for persistent access.
*   **System Update Log:** A visual changelog modal to keep users informed of new features.

### 🛠️ Administrator Controls
*   **Admin Tool Menu:** A centralized navigation bar for managing classes, homework, events, files, and emails.
*   **Storage Monitor:** Real-time visualization of Supabase storage usage (MB/GB) with breakdown by bucket.
*   **User Management:** A "Black List" view to manage registered students, view credentials (for recovery), and delete accounts.
*   **Impersonation Mode:** Admins can "Login as User" to view the dashboard from a specific student's perspective.
*   **Portal Gateway:** A calculated pop-up window to access the official university portal (`dione`) side-by-side.

### 🎨 Interactive UI Elements
*   **Sticky Notes:** Draggable, real-time sticky notes with improved physics.
*   **Wallpaper Generator V2:** Create custom wallpapers with *Glassmorphism* effects or custom backgrounds.
*   **Sketchy Aesthetics:** CSS-driven wobbly borders, hand-written fonts (*Patrick Hand*), and paper textures.
*   **Responsive Design:** Fully functional on desktop and mobile devices.

---

## 📸 Gallery

| **Login Screen** | **Digital Binder** |
|:---:|:---:|
| <img src="screenshots/login.png" alt="Login" width="400"> | <img src="screenshots/dashboard.png" alt="Dashboard" width="400"> |

| **Admin Panel** | **Mobile View** |
|:---:|:---:|
| <img src="screenshots/admin.png" alt="Admin" width="400"> | <img src="screenshots/mobile.png" alt="Mobile" width="400"> |

---

## 🛠️ Tech Stack

*   **Frontend:**
    *   HTML5 & CSS3 (Flexbox, Grid, CSS Variables, Animations)
    *   JavaScript (Vanilla ES6+)
    *   **Fonts:** Google Fonts (*Patrick Hand*, *Permanent Marker*)
    *   **Icons:** FontAwesome 6.5.2
*   **Backend & Database:**
    *   **Supabase:** PostgreSQL Database, Authentication logic, and File Storage.

---

## 💾 Database Schema

The application requires the following tables in Supabase:

1.  **`students`**: User credentials and profile data.
    *   `id` (uuid), `sr_code` (text), `password` (text), `name` (text), `avatar_url` (text), `last_login` (timestamp), `email` (text).
2.  **`schedule`**: Class timetables.
    *   `id`, `subject_code`, `subject_name`, `start_time`, `end_time`, `day_of_week`, `instructor`, `room`, `meet_link`, `classroom_link`.
3.  **`assignments`**: Homework tracking.
    *   `id`, `title`, `subject`, `description`, `due_date`.
4.  **`events`**: Calendar events.
    *   `id`, `title`, `event_date`, `description`.
5.  **`shared_files`**: Uploaded resources.
    *   `id`, `title`, `subject`, `file_url`, `file_type`.
6.  **`notes`**: Public sticky notes.
    *   `id`, `content`, `x_pos`, `y_pos`, `rotation`, `color`.
7.  **`requests`**: Anonymous messages to admin.
    *   `id`, `content`, `sender`, `created_at`.
8.  **`user_statuses`**: Custom status messages for users.
    *   `user_id`, `status`.

---

## 🚀 Installation & Setup

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/yourusername/sistema-ni-jv.git
    cd sistema-ni-jv
    ```

2.  **Supabase Configuration**
    *   Create a new project at [supabase.com](https://supabase.com).
    *   Create the tables listed in the [Database Schema](#-database-schema) section.
    *   **Storage:** Create two public buckets: `avatars` and `class-resources`.
    *   **Policies:** Enable RLS (Row Level Security) or allow public read/write access (depending on your security needs).

3.  **Connect the App**
    *   Open `script.js` and `dashboard.js`.
    *   Replace the `SUPABASE_URL` and `SUPABASE_KEY` constants with your project's credentials.

4.  **Run Locally**
    *   You can use the Live Server extension in VS Code or simply open `index.html` in your browser.

---

## ⚠️ Security Note

**Context:** This application was developed for a specific, closed group of trusted friends to facilitate easier account recovery and management.

*   **Password Storage:** Passwords are currently stored as plain text to allow the Admin to assist members who forget their credentials.
*   **Recommendation:** If you plan to deploy this for a public audience or a real production environment, **you must implement password hashing (e.g., bcrypt)** and stricter Row Level Security (RLS) policies in Supabase to protect user data.

---

## 🤝 Contributing

Contributions are welcome! If you have ideas to make the "Wimpy Kid" vibe even stronger or optimize the code:

1.  Fork the Project.
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the Branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

---

### 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

---

**Built with 🖤 by Joshua Vincent Bitancor**  
*aka "The Enrollment Savior"*