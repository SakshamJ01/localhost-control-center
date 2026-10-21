# Localhost — Developer Control Center

A calm, local-first desktop control center for managing your local projects, web services, and background processes in one place.

> **Working Promise:** *“See what’s running on your machine and get back to your project in one click.”*

---

## 🎯 Features

- **Project Registry:** Explicitly register local folders using the native OS directory picker. No silent recursive scanning.
- **App-Managed Process Supervision:** Launch user-configured commands without elevated privileges. Tracks and supervises only child processes created by this app.
- **Process Status Tracking:** Real-time process states (`RUNNING`, `EXITED`, `FAILED_TO_START`, `STOPPED`, `UNKNOWN`), live PID, and uptime counters.
- **Live Terminal & Output Streaming:** Inspect stdout/stderr in a real-time console drawer backed by a bounded ring buffer (5 MB memory cap) with search, copy, and clear controls.
- **Safe Stop & Tree Termination:** Stops only app-owned child processes cleanly (using `taskkill /pid <PID> /T /F` on Windows or `SIGTERM`/`SIGKILL` on POSIX).
- **One-Click Shortcuts:** Quick buttons to open the canonical folder in your native file manager (Windows File Explorer) or launch the local development URL in your default browser.
- **Safe Import & Export:** Export your project definitions without secrets or environment variables. Imported commands are **automatically set to disabled** until manually reviewed and approved.
- **Safe Removal Guarantee:** Removing a project card removes only Localhost metadata; your physical project folder and git history remain 100% untouched.
- **Transparent Audit Trail:** View local history of process starts, stops, and project configuration changes.

---

## 🔒 Security & Privacy Model

1. **Local-First & Offline:** Requires no cloud account, sends no network telemetry, and never uploads your code.
2. **Narrow Typed IPC Boundary:** Uses `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`. The webview cannot execute arbitrary shell commands or access generic filesystem APIs.
3. **Structured Launch Commands:** Commands are broken into explicit executables (e.g., `npm`, `python`, `cargo`) and argument arrays. Advanced shell mode requires explicit opt-in with a safety warning.
4. **Least Privilege:** Processes run under your standard user account with zero elevation.
5. **No Blind Process Killing:** Localhost never kills processes by port number or application name. It only manages the exact process tree it spawned.

---

## 🛠️ Stack & Architecture

- **Runtime:** Electron (Windows 10/11 native target)
- **Frontend:** React 19, TypeScript, Vite, Vanilla CSS design system
- **Icons:** Lucide React
- **Typography:** Inter (UI) & JetBrains Mono (Code/Commands/Logs)
- **Data Persistence:** Atomic JSON store located in OS User Data directory (`app.getPath('userData')`)
- **IPC Interface:** Allow-listed typed endpoints exposed via `window.localhostApi`

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
# Run both Vite frontend and Electron desktop app concurrently:
npm run dev:app

# Or run the web preview dev server directly:
npm run dev
```

### Building for Production

```bash
# Build both frontend bundle and Electron backend:
npm run build:all

# Start the built application:
npm start
```

### Keyboard Shortcuts

- `Ctrl + N` / `Cmd + N`: Add new project
- `/`: Focus search bar
- `Escape`: Close modals and console drawer

---

## 📄 License

MIT
