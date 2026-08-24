# 🏥 Healthcare Appointment & Follow-up Manager

> **Live Application URL:** [https://healthcare-appointment-manager-ls9t.onrender.com](https://healthcare-appointment-manager-ls9t.onrender.com)

A full-stack clinic management platform designed to streamline patient-doctor interactions. Features include role-based access control, AI-powered pre-visit symptom analysis and post-visit summaries, automated Google Calendar event synchronization, transactional double-booking protection, and background email reminders.

---

## 🚀 Key Features

* **Role-Based Portals:** Dedicated experiences for **Patients**, **Doctors**, and **Admins**.
* **Doctor & Leave Management:** Admins can manage doctor profiles, working hours, slot durations, and schedule leave days with automatic patient notification and conflict resolution.
* **Smart Slot Booking:** Safe concurrency control preventing double-booking and supporting temporary slot holds during checkout.
* **AI Clinical Insights (OpenAI / Gemini):**
  * **Pre-Visit Summaries:** Formats patient symptom inputs into structured complaints with urgency levels (Low/Medium/High) and suggested doctor questions.
  * **Post-Visit Summaries:** Translates clinical notes into patient-friendly follow-up instructions and prescriptions.
* **Google Calendar Integration:** Automatic creation, updates, and cancellations of Google Calendar events for both patients and doctors via OAuth 2.0.
* **Automated Reminders:** Nodemailer integration for booking confirmations, cancellation alerts, and medication reminder notifications.

---

## 🛠️ Tech Stack & Architecture

* **Frontend:** React, TypeScript, Vite, Tailwind CSS
* **Backend:** Node.js, Express, TypeScript
* **Database:** SQLite (`better-sqlite3` with WAL mode)
* **Integrations:** Google Calendar API (OAuth 2.0), OpenAI / Gemini API, Nodemailer
* **Deployment:** Render

---

## ⚙️ Local Setup Guide

### Prerequisites
* **Node.js:** v18.x or higher
* **npm:** v9.x or higher

### 1. Clone & Install Dependencies
```bash
git clone [https://github.com/Ishita1927/Healthcare-appointment-manager.git](https://github.com/Ishita1927/Healthcare-appointment-manager.git)
cd Healthcare-appointment-manager
npm install
