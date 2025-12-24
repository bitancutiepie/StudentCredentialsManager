# 📓 The Wimpy Credentials Book
> *Account Management, but make it "Diary of a Wimpy Kid" style.*

**"Ako na ang bahala sa enrollment niyo guys."**
A web-based credential management system with a "Diary of a Wimpy Kid" aesthetic. Built with HTML, CSS, JavaScript, and Supabase.

![Project Banner](https://img.shields.io/badge/Status-Active-success?style=for-the-badge) ![Vibe-Sketchbook](https://img.shields.io/badge/Vibe-Sketchbook-orange?style=for-the-badge) ![Tech-Supabase](https://img.shields.io/badge/Backend-Supabase-green?style=for-the-badge)

## 📖 About The Project
The **Wimpy Credentials Book** is a web-based Student Credentials Manager built to solve a specific problem: simplifying the enrollment process for a group of friends ("Mga Kosa"). 

Instead of a boring corporate interface, this project utilizes a **hand-drawn, sketchbook aesthetic** inspired by the *Diary of a Wimpy Kid* series. It features custom CSS animations, wobbly borders, and a paper-texture feel, proving that utility apps can still be fun.

## ✨ Key Features & Functions

### 🔐 Authentication
- **`handleRegister(name, srCode, password)`**: Handles new user registration and adds them to the `students` table in Supabase.
- **`handleLogin(srCode, password)`**: Validates credentials against the database. Routes users to either the Admin Dashboard (if SR Code is 'ADMIN') or the Student Dashboard.
- **`logout()`**: Resets the application state, clears inputs, and returns to the login screen.

### 🛠️ Admin Dashboard
- **`fetchStudents()`**: Retrieves the full list of registered students (ID, Name, SR Code, Password) from Supabase.
- **`displayStudents(students)`**: Dynamically populates the admin table. Includes "Copy" buttons for SR Codes and Passwords.
- **Search Mechanic**: Real-time filtering of the student list by Name or SR Code via the `searchInput` event listener.
- **`deleteStudent(id)`**: Allows admins to remove users from the database with a confirmation prompt ("Scratch this person out specifically?").
- **`openPortalWindow()`**: Opens the university portal (`dione.batstate-u.edu.ph`) in a centered, standalone pop-up window calculated based on screen size.

### 📝 Student Features (Sticky Notes)
- **`postNote()`**: Creates sticky notes with randomized colors, rotations, and positions. Saves them to the `notes` table.
- **`fetchNotes()`**: Loads all sticky notes from the database for global display on the "Note Layer".
- **`makeDraggable(element, noteId)`**: Implements drag-and-drop functionality. Includes collision detection logic to prevent notes from overlapping the main content box (`.sketch-box`).
- **`updateNotePosition(id, x, y)`**: Persists the new coordinates (as percentages) of a dragged note to Supabase.

### 🧰 Utilities
- **`showToast(message, type)`**: Provides visual feedback (success/error) using custom toast notifications.
- **`copyToClipboard(text)`**: Helper function to copy text to the clipboard, triggering a success toast.
- **`fetchMembers()`**: Updates the public "Members currently in the club" list on the login page, filtering out Admin accounts.

## 🎨 UI/UX Design
* **Sketchbook Theme:** Uses the *Patrick Hand* font and CSS gradients to simulate lined paper.
* **Interactive Animations:** Buttons "wiggle" on hover; pages "slide up" like turning a page.
* **Sticky Note Toasts:** Custom notifications that look like yellow sticky notes.

## 📸 Screenshots
| Login Screen | Admin Dashboard | Student Profile |
|:---:|:---:|:---:|
| <img src="screenshot1.png" width="250"> | <img src="screenshot2.png" width="250"> | <img src="screenshot3.png" width="250"> |

## ️ Tech Stack
* **Frontend:** HTML5, CSS3 (Advanced Animations), Vanilla JavaScript.
* **Backend:** Supabase (PostgreSQL).
* **Assets:** Google Fonts, Custom Sketch Images.

## 🚀 How to Run
1.  **Clone the repo** (or download the files).
2.  Ensure `index.html`, `script.js`, and assets are in the same folder.
3.  **Configure Supabase:**
    *   Create a Supabase project.
    *   Set up tables: `students` (id, name, sr_code, password) and `notes` (id, content, x_pos, y_pos, rotation, color).
    *   Update `SUPABASE_URL` and `SUPABASE_KEY` in `script.js`.
4.  **Open `index.html`** in any modern web browser.

## ⚠️ Note on Security
**Context:** This application was built specifically for a closed group of trusted friends.
* **Design Choice:** Password hashing is **disabled** to allow the Admin to recover passwords for friends.
* **CRITICAL:** For any public or production environment, **you MUST implement password hashing** (e.g., Bcrypt). Do not use this code as-is for sensitive data.

## 🤝 Contributing
Feel free to fork the repository and adapt it for your own needs!

## 📄 License
MIT License.

## Author
Built with 🖤 by **Joshua Vincent Bitancor** *aka "The Enrollment Savior"*

---
*Inspired by Jeff Kinney's Diary of a Wimpy Kid.*
