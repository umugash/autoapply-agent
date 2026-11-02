# ⚡ Antigravity AutoApply AI Agent

> **Autonomous, Human-in-the-Loop Job Application Automation & Resume Matching System**  
> Designed for official corporate career portals (Workday, Greenhouse, Lever, Ashby, and custom ATS sites).

---

## 🌟 Key Features

1. **Intelligent Multi-Resume Matcher**:
   - Analyzes Job Descriptions (JD), tech stack, and role requirements from any job link.
   - Automatically selects the optimal resume profile from your multi-resume portfolio (e.g. *Backend*, *AI/ML*, *Fullstack*, *Data Analyst*).
   - Generates match score breakdown and attaches the appropriate PDF resume.

2. **Smart Form Auto-Filling (Pre-requisite Knowledge Base)**:
   - Accurately fills personal details, contact info, LinkedIn/GitHub/Portfolio links, work authorization, sponsorship, notice period, and desired salary.
   - Supports text fields, textareas, dropdowns, radio buttons, checkboxes, and file uploads.

3. **Active Learning & Dynamic Memory**:
   - When encountering a new, unrecognized screening question on an official site, the agent prompts you via the dashboard.
   - **Remembers Forever**: Once answered, the response is instantly stored in `learned_qa.json` with pattern matching. Future applications asking similar questions are filled 100% autonomously!

4. **Human-in-the-Loop Visual Highlighting**:
   - **Official Portal Login, OTP / 2FA, & CAPTCHA (Turnstile / reCAPTCHA / hCaptcha)**:
     - The agent detects login walls or security challenges, pauses the automation, and visually highlights the challenge with a glowing neon border.
     - Displays an on-screen floating HUD banner: `"⚠️ Action Needed: Please complete CAPTCHA / enter OTP, then click Resume"`.
     - Plays an alert sound and lets you finish the sensitive verification before continuing automatically.

5. **Official ATS & Custom Portal Support**:
   - Works across **Greenhouse**, **Lever**, **Ashby**, **Workday**, and generic company career pages.

6. **Safety & Review Mode**:
   - By default, stops before the final "Submit" button and highlights it so you can do a 5-second visual audit before final submission.
   - Optional 1-click toggle for full "Auto-Submit" if you prefer zero-click end-to-end execution.

---

## 🚀 Quick Start Guide

### 1. Launch the Agent
Double-click `start.bat` or run in terminal:
```bash
cd C:\Users\umuga\.gemini\antigravity-ide\scratch\autoapply-agent
call venv\Scripts\activate
python run.py
```
The dashboard will automatically open at: **http://127.0.0.1:8000**

---

## 🖥️ Dashboard Overview

- **🚀 Live Apply & Queue**:
  - Paste single or batch job links.
  - Watch live telemetry, step-by-step progress, and real-time logs.
  - Review queued applications, status badges, and matched resumes.
- **👤 Candidate Profile & Knowledge**:
  - Customize all your contact info, links, notice period, salary, and work authorization preferences.
- **📄 Resume Matcher Hub**:
  - View registered resume versions and key skill tags.
  - Interactive Sandbox: Paste any Job Title & Description to test how the agent scores and selects the winning resume.
  - Upload custom PDF or DOCX resumes.
- **🧠 Dynamic Learned Memory (Q&A)**:
  - View, search, edit, or add custom screening questions.
- **📊 Full Activity Audit Trail**:
  - Detailed timestamps and history of all applied jobs.

---

## 📁 Project Architecture

```
autoapply-agent/
│
├── backend/
│   ├── agent/
│   │   ├── knowledge.py          # Dynamic memory & fuzzy question resolver
│   │   ├── matcher.py            # Multi-resume evaluator & JD analyzer
│   │   ├── form_filler.py        # Universal ATS & heuristic form filler
│   │   ├── browser_controller.py # Playwright automation & stealth
│   │   ├── runner.py             # Queue orchestrator & event dispatcher
│   │   └── highlighter.js        # On-screen glowing highlighter & HUD overlay
│   │
│   ├── data/
│   │   ├── profile.json          # Candidate personal & work details
│   │   ├── learned_qa.json       # Auto-learned screening questions database
│   │   ├── resumes.json          # Resume metadata, roles, and skills
│   │   ├── queue.json            # Active job queue & audit history
│   │   └── resumes/              # Storage directory for PDF/DOCX resumes
│   │
│   ├── create_sample_resumes.py  # Sample PDF generator
│   └── main.py                   # FastAPI server & WebSocket live stream
│
├── frontend/
│   ├── index.html                # Modern single-page web dashboard
│   ├── css/style.css             # Glassmorphic dark design system
│   └── js/app.js                 # WebSocket client, audio chimes & state
│
├── requirements.txt              # Python dependencies
├── run.py                        # Master launcher script
└── start.bat                     # Windows batch launcher
```
