# System Architecture — Localhost Control Center

This document outlines the architecture, execution runtime models, process supervision mechanisms, and security invariants implemented in **Localhost Developer Control Center**.

---

## 1. Dual Execution Runtime Model

Localhost is designed to be **dual-runtime compatible**:

```
                                  ┌──────────────────────────────────────────────┐
                                  │            React 19 Frontend UI              │
                                  │   (Dashboard, Modals, Console, Components)   │
                                  └──────────────────────┬───────────────────────┘
                                                         │
                                               window.localhostApi
                                                         │
                         ┌───────────────────────────────┴───────────────────────────────┐
                         │                                                               │
                         ▼ (Electron Desktop Runtime)                                    ▼ (Browser Dev Runtime)
          ┌─────────────────────────────┐                                 ┌─────────────────────────────┐
          │     electron/preload.ts     │                                 │     src/mock/mockApi.ts     │
          │  contextBridge.exposeInMain │                                 │ In-browser localStorage &   │
          └──────────────┬──────────────┘                                 │ Vite Dev Server API Plugin  │
                         │ ipcRenderer.invoke                             └──────────────┬──────────────┘
                         ▼                                                               │ fetch('/api/dev/...')
          ┌─────────────────────────────┐                                                ▼
          │      electron/main.ts       │                                 ┌─────────────────────────────┐
          │    Native IPC Dispatcher    │                                 │       vite.config.mts       │
          └──────┬───────────────┬──────┘                                 │   localhostDevApiPlugin()   │
                 │               │                                        └──────────────┬──────────────┘
                 ▼               ▼                                                       │
        ┌─────────────────┐ ┌─────────────────┐                                          │
        │ProcessSupervisor│ │   Store (JSON)  │                                          │
        │ taskkill / PID  │ │ %APPDATA%/userData│                                         │
        └────────┬────────┘ └─────────────────┘                                          │
                 │                                                                       │
                 ▼                                                                       ▼
          Local OS Processes                                                      Host Filesystem
```

### A. Electron Desktop Runtime (Production)
- **Renderer Isolation**: The React frontend runs in a secure Chromium sandbox (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`).
- **Preload Bridge**: [electron/preload.ts](file:///c:/Users/Saksham/Documents/Localhost%20%E2%80%94%20Developer%20Control%20Center/electron/preload.ts) exposes only strongly-typed functions via `window.localhostApi`.
- **Main Process**: [electron/main.ts](file:///c:/Users/Saksham/Documents/Localhost%20%E2%80%94%20Developer%20Control%20Center/electron/main.ts) handles OS window management, safe external link opening, native directory picker dialogs, and IPC routing.

### B. Browser Dev Preview Runtime (`localhost:5173`)
- **Fast UI Prototyping**: Allows running `npm run dev` to preview and test the UI in standard web browsers without bundling Electron.
- **Node.js Filesystem Bridge**: In browser mode, [vite.config.mts](file:///c:/Users/Saksham/Documents/Localhost%20%E2%80%94%20Developer%20Control%20Center/vite.config.mts) runs a custom middleware plugin providing:
  - `/api/dev/detect-project`: Inspects packages on the host machine.
  - `/api/dev/read-project-context`: Reads `README.md` and `.env.example` for AI analysis.
  - `/api/dev/ai-chat`: Acts as an AI proxy to circumvent browser CORS and ad-blockers.

---

## 2. Process Supervisor & Lifecycle Engine

The `ProcessSupervisor` class manages child processes spawned by the application:

### Invariants:
1. **Least Privilege**: Commands are executed using standard user permissions with zero elevation (`sudo`/admin rights are never requested).
2. **Strict Process Ownership**: The app only tracks and supervises processes **it spawned**. It will **never** kill arbitrary processes by port number or application name.
3. **Structured Execution**: Commands are parsed into an executable binary (e.g. `npm`) and an array of arguments (e.g. `['run', 'dev']`), avoiding shell injection vulnerabilities.
4. **Tree Termination**: On process stop, the entire process tree is cleanly terminated:
   - **Windows**: `taskkill /pid <PID> /T /F`
   - **POSIX (macOS/Linux)**: `kill -SIGTERM -<PGID>` followed by `kill -SIGKILL` if unresponsive.
5. **Clean Exit**: When Localhost exits, all active child processes are terminated according to user preferences (`terminate_children_on_exit: true`).

---

## 3. Output Streaming & Memory Protection

Process stdout and stderr streams can easily emit gigabytes of logs, risking UI freezes:

- **Chunked IPC Streaming**: Output chunks are throttled and dispatched via `ipcRenderer.send('process-output', chunk)` with timestamp and stream tags (`stdout`, `stderr`, `system`).
- **Bounded Ring Buffer**: The output buffer caps retained memory at **5 MB per process** (or 1,000 lines). Older logs are rotated out automatically.
- **Decoupled UI Rendering**: The Process Console Drawer renders text in a virtualized or bounded list to preserve 60fps dashboard performance.

---

## 4. Storage & Persistence Schema

### Location:
- **Electron**: OS User Data directory via `app.getPath('userData')` (e.g. `C:\Users\<User>\AppData\Roaming\Localhost`).
- **Browser Mode**: Browser `localStorage` (`localhost_browser_mock_projects`, `localhost_browser_mock_settings`, `localhost_browser_mock_audit`).

### Atomic JSON Storage:
All writes to `projects.json`, `settings.json`, and `audit.json` use atomic file replacement (writing to a temporary file `.tmp` and renaming) to prevent corruption during unexpected power loss.

### Safe Import Guarantee:
When importing configuration files:
- All imported project IDs are regenerated to prevent collision.
- The `command_disabled` flag is unconditionally set to `true`. Commands **cannot** be executed until the user explicitly reviews and enables them.
