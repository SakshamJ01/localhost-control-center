# Quickstart Guide — Localhost Control Center

Welcome to **Localhost Developer Control Center**! This guide walks you through setting up, registering your first project, and leveraging the AI Analyzer to configure your dev environment in seconds.

---

## 1. Launching the App

Localhost supports two execution environments:

### Option A: Native Desktop App (Recommended)
Launches the full Electron desktop application with native OS process management:
```bash
npm start
```
*(Or during active development: `npm run dev:app` to run Vite + Electron concurrently)*

### Option B: Browser Web Preview
Runs the lightweight web dashboard in your browser (`http://localhost:5173`) with live Node.js filesystem dev bridge:
```bash
npm run dev
```

---

## 2. Registering Your First Project

### Step 1: Open the Project Modal
- Click the **`+ Add Project`** button in the top navigation, or press `Ctrl + N` (`Cmd + N` on macOS).

### Step 2: Choose Your Project Folder
- **Via Native Picker**: Click **`Browse...`** to pick your repository directory.
- **Via Copy & Paste**: Paste any folder path into the **Project Folder Path** input (e.g. `C:\Users\You\Documents\my-app`).
  - *Tip:* Windows *"Copy as Path"* quotes (`"C:\..."`) are automatically sanitized and stripped.

### Step 3: Instant Auto-Detection & AI Intelligence
Once the folder is selected, Localhost automatically:
1. **Reads Project Manifests**: Scans `package.json`, `Cargo.toml`, `requirements.txt`, etc.
2. **Detects Framework**: Identifies Vite, Next.js, Create React App, Astro, FastAPI, Node, etc.
3. **Populates Commands**: Auto-fills the recommended script (e.g. `npm run dev` or `python app.py`) and dev URL (e.g. `http://localhost:3000`).
4. **Triggers AI Intelligence**: If enabled, AI analyzes your `README.md` and dependencies to generate tailored explanations and prerequisite warnings.

### Step 4: Review and Save
- Review the configured **Display Name**, **Executable**, **Arguments**, and **Development URL**.
- Click **`Register Project`**. Your project card will now appear in the dashboard!

---

## 3. Configuring AI Project Intelligence

Localhost includes an AI analysis assistant that understands your project structure and recommends the exact way to run it.

### Using Free OpenRouter Models (No Credit Card Required)
1. Open **Settings** (gear icon in the top right) → Navigate to the **`AI Intelligence`** tab.
2. Select **OpenRouter** as your AI Provider.
3. Get a free API key from [OpenRouter.ai/keys](https://openrouter.ai/keys).
4. Paste your API key into the field.
5. Click one of the **Free Model Chips**:
   - `google/gemini-2.0-flash-exp:free` (Fastest, recommended)
   - `meta-llama/llama-3.3-70b-instruct:free` (Deep reasoning)
6. Click **`Test Connection`**. You will see a live latency badge (e.g. `⚡ 420ms`) confirming your key is active.
7. Click **`Save AI Settings`**.

### Zero-API-Key Local Heuristic Engine
Don't want to use an external AI API? No problem!
- If no API key is provided, Localhost automatically switches to its **Local Smart Heuristic Engine**.
- It analyzes your project AST, `scripts`, dependencies, and `README.md` locally on your machine with **zero network requests**.

---

## 4. Managing Your Running Projects

### Starting a Process
- Click the green **`▶ Run`** button on any project card.
- The process status changes to **`RUNNING`** with a live uptime counter and OS Process ID (PID).

### Viewing Live Output & Terminal Logs
- Click **`Console`** or the terminal icon on the card to open the **Process Console Drawer**.
- Features:
  - **Live ANSI Color Streaming**: Watch compiler and dev server logs in real time.
  - **Filter / Search**: Quickly find errors or port numbers.
  - **Memory Capped**: Output is bounded by a safe 5 MB ring buffer so your system never slows down.

### Opening in Browser or Folder
- **Open URL**: Click the URL badge (e.g. `http://localhost:5173`) to open the app directly in your default browser.
- **Open Folder**: Click the folder icon to reveal the project files in Windows File Explorer or Finder.

### Stopping a Process
- Click the red **`⏹ Stop`** button.
- Localhost performs a **safe tree termination** (`taskkill /T /F` on Windows or `SIGTERM` on POSIX) to kill the process and all spawned child processes cleanly.

---

## 5. Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + N` / `Cmd + N` | Open "Add Project" modal |
| `/` | Focus search and filter bar |
| `Escape` | Close any active modal or console drawer |

---

## 6. Frequently Asked Questions (FAQ)

#### Q: Does removing a project delete my code?
**A:** No, absolutely not. Removing a project only deletes its card from Localhost's internal registry. Your files, git repository, and branches remain 100% untouched.

#### Q: Can I run multiple projects at the same time?
**A:** Yes! You can run as many independent dev servers concurrently as your machine's CPU and RAM allow.

#### Q: Why did imported projects have their commands disabled?
**A:** For security! When importing project configurations from a file, commands are disabled by default until you inspect them to prevent running unintended scripts.
