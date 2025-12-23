# 📓 The Wimpy Credentials Book
> *Account Management, but make it "Diary of a Wimpy Kid" style.*

**"Ako na ang bahala sa enrollment niyo guys."**

![Project Banner](https://img.shields.io/badge/Status-Active-success?style=for-the-badge) ![Vibe-Sketchbook](https://img.shields.io/badge/Vibe-Sketchbook-orange?style=for-the-badge) ![Tech-Supabase](https://img.shields.io/badge/Backend-Supabase-green?style=for-the-badge)

##  Table of Contents
- [📖 About The Project](#-about-the-project)
- [✨ Key Features](#-key-features)
  - [🎨 UI/UX Design](#-uiux-design)
  - [🔐 Core Functionality](#-core-functionality)
- [📸 Screenshots](#-screenshots)
- [🛠️ Tech Stack](#-tech-stack)
- [🚀 How to Run](#-how-to-run)
- [⚠️ Note on Security](#-note-on-security)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)
- [👨‍💻 Author](#author)

## 📖 About The Project
The **Wimpy Credentials Book** is a web-based Student Credentials Manager built to solve a specific problem: simplifying the enrollment process for a group of friends ("Mga Kosa"). 

Instead of a boring corporate interface, this project utilizes a **hand-drawn, sketchbook aesthetic** inspired by the *Diary of a Wimpy Kid* series. It features custom CSS animations, wobbly borders, and a paper-texture feel, proving that utility apps can still be fun.

## 📸 Screenshots
| Login Screen | Admin Dashboard | Student Profile |
|:---:|:---:|:---:|
| <img src="screenshot1.png" width="250"> | <img src="screenshot2.png" width="250"> | <img src="screenshot3.png" width="250"> |
## ✨ Key Features

### 🎨 UI/UX Design
* **Sketchbook Theme:** Uses the *Patrick Hand* font and CSS gradients to simulate lined paper.
* **Interactive Animations:** Buttons "wiggle" on hover; pages "slide up" like turning a page.
* **Sticky Note Toasts:** Custom notifications that look like yellow sticky notes instead of standard browser alerts.

### 🔐 Core Functionality
* **Secret Admin Backdoor:** Login with special admin credentials to access "The Black List."
* **Public Class List:** Automatically fetches and displays names of enrolled members on the login screen.
* **One-Click Copy:** Admin can instantly copy SR Codes and Passwords to the clipboard for fast enrollment processing.
* **Student ID Badge:** Users get a personalized "ID Card" view upon login.

## 🛠️ Tech Stack
* **Frontend:** HTML5, CSS3 (Advanced Animations), Vanilla JavaScript.
* **Backend:** Supabase (PostgreSQL).
* **Assets:** Google Fonts, Custom Sketch Images.

## 🚀 How to Run
This project uses a Serverless architecture (Supabase), so no local backend server is required!

1.  **Clone the repo** (or download the files).
2.  Ensure `index.html`, `script.js`, and `pat.png` are in the same folder.
3.  **Open `index.html`** in any modern web browser.
4.  **Configure Supabase (Optional, for full functionality):**
    *   Create a Supabase project.
    *   Set up your database schema (tables for users, credentials, etc., as per `script.js`).
    *   Update the `SUPABASE_URL` and `SUPABASE_ANON_KEY` variables in `script.js` with your project's credentials.
5.  *Optional:* For the Admin view, log in with the configured Admin SR Code (this would be set up within your Supabase database).

## ⚠️ Note on Security
**Context:** This application was built specifically for a closed group of trusted friends to facilitate shared enrollment tasks. 
* **Design Choice:** Password hashing was intentionally disabled in the final build to allow the Admin (me) to view and recover passwords for friends who forget them during the enrollment period.
* **CRITICAL BEST PRACTICE:** **For any public or production environment, or if you are handling sensitive data for others, you MUST implement robust password hashing (e.g., `Bcrypt`, `Argon2`) and never store plain-text passwords.** This project's security design is *not* suitable for general use.

## 🤝 Contributing
This project was primarily built for a specific personal use case. As such, contributions are not actively sought, but feel free to fork the repository and adapt it for your own needs!

## 📄 License
This project is licensed under the MIT License - see the `LICENSE` file for details (if you choose to add one).

## Author
Built with 🖤 by **Joshua Vincent Bitancor** *aka "The Enrollment Savior"*

---
*Inspired by Jeff Kinney's Diary of a Wimpy Kid.*
