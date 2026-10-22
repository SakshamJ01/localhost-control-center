# Localhost — Developer Control Center

<div align="center">

![Localhost Banner](https://img.shields.io/badge/Localhost-Developer_Control_Center-6366f1?style=for-the-badge&logo=electron&logoColor=white)
<br/>

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.x-61dafb?style=flat-square&logo=react)](https://react.dev/)
[![Electron](https://img.shields.io/badge/Electron-45.x-47848F?style=flat-square&logo=electron)](https://www.electronjs.org/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?style=flat-square&logo=vite)](https://vitejs.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

**A calm, local-first desktop control center for managing your local projects, web services, and background processes in one place.**

> **Working Promise:** *“See what’s running on your machine and get back to your project in one click.”*

[Quickstart Guide](docs/QUICKSTART.md) • [AI Intelligence Guide](docs/AI_INTELLIGENCE.md) • [System Architecture](docs/ARCHITECTURE.md)

</div>

---

## 🎯 Key Features

### 🧠 AI Project Intelligence & Auto-Detection
- **1-Click Auto-Detection**: Point Localhost to any folder; it automatically parses `package.json`, `Cargo.toml`, or `requirements.txt` to identify the framework, recommended launch script, and default port.
- **AI Codebase Analyzer**: Integrates with **OpenRouter**, **Google Gemini**, and **OpenAI** to analyze `README.md` and dependencies, explaining the exact setup steps and potential gotchas.
- **Zero-Credit Free Models**: Pre-configured chips for free OpenRouter models (`google/gemini-2.0-flash-exp:free`, `meta-llama/llama-3.3-70b-instruct:free`).
- **Offline AST Heuristic Fallback**: Don't want to use an external API? Localhost falls back to a smart local AST/heuristic engine with **zero network traffic**.
- **Live Connection Diagnostics**: "Test Connection" button in Settings gives millisecond latency feedback for your API keys.

### 🛡️ App-Managed Process Supervision
- **Strict Process Ownership**: Launches user-configured commands without elevated privileges. Tracks and supervises only child processes created by this app.
- **Process Status Tracking**: Real-time process states (`RUNNING`, `EXITED`, `FAILED_TO_START`, `STOPPED`, `UNKNOWN`), live OS PIDs, and uptime timers.
- **Live Terminal Console Drawer**: Inspect stdout/stderr in a real-time console drawer backed by a bounded ring buffer (5 MB memory cap) with search, copy, and clear controls.
- **Safe Tree Termination**: Stops only app-owned child processes cleanly (`taskkill /pid <PID> /T /F` on Windows or `SIGTERM`/`SIGKILL` on POSIX). Never kills processes blindly by port number or application name.

### ⚡ One-Click Developer Workflow
- **Instant Shortcuts**: One-click buttons to open the project folder in your native file manager (Windows File Explorer / Finder) or launch the local URL in your default browser.
- **Safe Import & Export**: Export your configuration as clean JSON. Imported commands are **automatically disabled** until manually reviewed and approved.
- **Safe Removal Guarantee**: Removing a project card deletes only Localhost metadata; your physical project folder, files, and git history remain 100% untouched.
- **Transparent Audit Trail**: View a complete local audit log of process starts, stops, and project updates.

---

## 📖 How to Add & Configure Projects

### Method 1: Instant Auto-Detection & AI (Recommended)
1. Click **`+ Add Project`** (`Ctrl + N`).
2. Click **`Browse...`** to pick your repository folder (or paste the folder path directly).
   - *Windows Tip:* Pasting paths copied via *"Copy as Path"* automatically strips outer quotes (`"C:\..."`).
3. Localhost immediately detects your framework, recommended command, and dev URL.
4. Click **`Register Project`** to finish!

### Method 2: Manual Structured Configuration
For custom scripts or complex setups:
- **Executable**: The binary name **only** (e.g. `npm`, `python`, `cargo`, `go`, `node`).
- **Arguments**: Subcommands and flags (e.g. `run dev`, `app.py`, `run`).
  - *Tip: Do not repeat the executable in the arguments field (e.g., use `npm` + `run dev`, NOT `npm` + `npm run dev`).*

### Common Runtime Examples:

| Project Type | Executable | Arguments | Example Dev URL |
| :--- | :--- | :--- | :--- |
| **Next.js / Vite / React / Vue** | `npm` | `run dev` | `http://localhost:3000` or `http://localhost:5173` |
| **Node.js Production Server** | `npm` | `start` | `http://localhost:8080` |
| **Python Script / Web Server** | `python` | `app.py` | `http://localhost:5000` |
| **Python FastAPI / Uvicorn** | `python` | `-m uvicorn main:app --reload` | `http://localhost:8000/docs` |
| **Rust Project** | `cargo` | `run` | `http://localhost:8080` |
| **Go Project** | `go` | `run .` | `http://localhost:8080` |
| **Static HTML / Quick Preview** | `npx` | `serve .` | `http://localhost:3000` |
| **Passive Folder (Notes / Storage)** | *(leave empty)* | *(leave empty)* | *(leave empty)* |

---

## 🔒 Security & Privacy Model

1. **Local-First & Offline**: Requires no cloud account, sends no analytics/telemetry, and never uploads your source code.
2. **Narrow Typed IPC Boundary**: Electron webview runs with `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`. The frontend cannot execute arbitrary shell commands or access raw filesystem APIs.
3. **Structured Launch Commands**: Commands are parsed into an executable binary and argument array. Advanced shell mode requires explicit opt-in with a safety warning.
4. **Least Privilege**: All processes execute under your current user account with zero elevation.
5. **No Blind Process Killing**: Localhost never terminates processes by searching for port numbers or application names. It manages strictly the exact process tree it spawned.

---

## 🛠️ Stack & Architecture

- **Runtime**: Electron (Windows 10/11 native target)
- **Frontend**: React 19, TypeScript, Vite, Vanilla CSS design system
- **Icons**: Lucide React
- **Typography**: Inter (UI) & JetBrains Mono (Code/Commands/Logs)
- **Data Persistence**: Atomic JSON store located in OS User Data directory (`app.getPath('userData')`)
- **IPC Interface**: Allow-listed typed endpoints exposed via `window.localhostApi`

For in-depth architectural details, refer to [System Architecture](docs/ARCHITECTURE.md).

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Installation
```bash
npm install
```

### Running Locally

```bash
# 1. Native Desktop Mode (Concurrent Vite + Electron app):
npm run dev:app

# 2. Browser Dev Preview (Vite dev server at http://localhost:5173):
npm run dev
```

### Building for Production

```bash
# Compile both the React frontend and Electron main process:
npm run build:all

# Start the built desktop application:
npm start
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + N` / `Cmd + N` | Add new project |
| `/` | Focus search and filter bar |
| `Escape` | Close active modal or console drawer |

---

## 📚 Documentation Index

- [Quickstart Guide](docs/QUICKSTART.md): Step-by-step onboarding walkthrough and FAQ.
- [AI Intelligence Guide](docs/AI_INTELLIGENCE.md): Deep-dive into AI models, free tiers, and offline heuristic fallbacks.
- [System Architecture](docs/ARCHITECTURE.md): Dual-runtime architecture, process supervision, and IPC boundaries.
- [Product Specification](PRODUCT_SPEC.md): Full product specification and security invariants.

---

## 📄 License

MIT © [Saksham](https://github.com/SakshamJ01)
