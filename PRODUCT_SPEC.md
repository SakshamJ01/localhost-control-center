# Localhost — Developer Control Center Product Specification

**Document purpose:** Self-contained brief for a solo developer building a local-first desktop utility. “Localhost” is a working name and must be checked for product/name conflicts before launch.

## 1. Product vision

Give an individual developer one calm home screen for the projects and local services they already run: find a project, see its configured status, open its folder or development URL, and run a small set of explicitly configured actions. This is a personal control panel, not a remote administration platform.

**Working promise:** “See what’s running on your machine and get back to your project in one click.”

## 2. Users, problem, value, differentiator

**Primary users:** students, indie developers, and small-team developers who run several local projects, databases, or development servers on one computer.

**Problem:** project folders, terminals, browser tabs, ports, and notes are scattered. People forget which service belongs to which project and repeat setup steps.

**Core value:** organize local projects and provide quick, understandable shortcuts to their folders, URLs, and safe configured commands.

**Differentiator:** explicit local project registry with transparent status and user-approved actions. It does not silently scan or control the machine. The app says exactly which command it will run and where.

## 3. Scope and principles

Build one desktop operating system target first (recommended: Windows if that is the developer's primary environment), then add macOS/Linux after the local process and permission model is proven. Mobile companion, if ever built, is view-only and requires deliberate secure pairing; it is not part of the MVP.

Principles: local-first, least privilege, visible actions, no command execution from imported project metadata, and useful without a cloud account.

## 4. MVP

Desktop app with project cards/list, manually added project folder, optional dev URL, optional user-authored launch command, and basic status notes. Open the project folder and URL; run/stop only the app-owned child process started by the app. Show command, working directory, output summary, exit status, and stop control. Persist settings locally. Include a safe setup wizard and removal flow.

MVP platform: Windows 10/11, current supported versions. Decide installer/update approach before public release. Keep app data in the OS user data directory; project source files remain untouched.

**MVP exclusions:** remote access, arbitrary shell on phone, automatic machine-wide process termination, Docker/Kubernetes orchestration, SSH, cloud account sync, AI command generation/execution, automatic repo scanning, credential storage, team collaboration, plugin marketplace, and production server management.

## 5. Roadmap

**V1:** macOS/Linux support; carefully designed process groups; health checks against user-provided local URLs; project tags/search; configurable port display; export/import of non-secret configuration; optional OS keychain for sensitive env values only if demanded; signed auto-update channel.

**V2:** optional encrypted sync of project metadata (never source or secrets by default), user-installed integrations, container status read-only integration, and secure mobile view-only companion. Each integration requires a threat review and opt-in.

**Optional long-term integration:** a future connection could open a project from a learning map or planning workspace. No shared data or account dependency is needed; keep the desktop utility independently useful.

## 6. User flows

1. **First run:** explain local-only behavior → choose “add project” → select folder using native picker → enter display name and optional URL/command → show command preview and risk note → save.
2. **Daily use:** dashboard → see project and process state → open folder/browser → optionally launch configured command → inspect live output and exit code → stop app-owned process.
3. **Edit/remove:** project settings → edit URL/command → verify working directory and preview → save; removing a card removes only Localhost metadata, never the source folder.
4. **Recovery:** app restart shows persisted project definitions and clearly labels processes not started/managed by this app as unknown unless reliably checked.

## 7. Screens

- **Onboarding/privacy:** what is stored locally, permissions, data paths.
- **Dashboard:** project list, tags, configured URL, app-managed process state, quick open/run actions.
- **Add/edit project:** native directory picker, display name, URL, command, arguments, working directory, environment variable names (values excluded in MVP), startup behavior off by default.
- **Process panel:** exact command display, working directory, timestamp, stdout/stderr tail, exit code, stop button.
- **Settings:** startup preference, log size/retention, data export/import, app updates, delete all app metadata.

## 8. Feature and functional requirements

- Project registration is explicit; never recursively crawl folders.
- Launch command is a structured executable plus argument array, not a shell string where possible. If shell support is necessary, make it an explicit advanced mode with confirmation and platform-aware quoting.
- Before run, show executable, arguments, working directory, and whether environment values will be passed.
- Spawn processes without elevated privileges; track only processes created by this app. Stop only the child/process group this app owns; never kill a process by port or name in MVP.
- Render output as text, escape HTML, cap retained output (for example 5 MB per process), and rotate logs.
- Validate folder still exists and show actionable missing-path state. Validate URLs as HTTP(S) or localhost schemes supported by policy.
- Never execute commands imported from a file. Import only a documented safe schema and mark commands disabled until reviewed.
- Support duplicate project path warning, project reorder, search, archive/remove, and local configuration export.
- App must work offline; it does not require login.

## 9. Non-functional requirements

- Keep the main dashboard responsive; process output must not block the UI thread.
- Startup target under 3 seconds on a typical student laptop; handle 50 registered projects without sluggishness.
- Process state must distinguish `running_by_app`, `exited`, `failed_to_start`, and `unknown`.
- Logs are bounded and stored with restrictive user-only filesystem permissions where supported.
- Clear crash recovery behavior; app restart must not automatically relaunch arbitrary commands.
- Package with code signing where available; disclose update source and provide manual update path.
- Accessible keyboard navigation, screen reader labels, contrast, and non-color state indicators.

## 10. Suggested stack and architecture

**Recommended:** Tauri 2 with TypeScript/React frontend and Rust backend for OS integration, filesystem picker, process lifecycle, and secure IPC. SQLite or a small versioned JSON database stored in the app data directory. Avoid exposing generic filesystem or shell APIs to the webview. An alternative Electron stack is acceptable if the developer already knows it, provided `contextIsolation`, sandboxing, and narrow IPC are configured.

**Architecture:** UI → allow-listed typed IPC commands → Rust/Node service layer → OS process API / JSON store / native folder picker. Define a `ProjectService`, `ProcessSupervisor`, and `SettingsStore`. Process output streams asynchronously to a bounded ring buffer. No remote backend in MVP.

## 11. Data model

- `projects`: id, name, canonical_path, dev_url nullable, executable nullable, args_json, working_directory, tags_json, created_at, updated_at, archived_at nullable.
- `process_runs`: id, project_id, pid nullable, started_at, ended_at nullable, status, exit_code nullable, output_file nullable; do not persist full output by default.
- `settings`: schema_version, log_retention, launch_on_login false by default, update_channel.
- `audit_events`: local event type and timestamp for run/stop/config changes; avoid recording command output or environment values.

Do not store secrets in the MVP database. If environment-variable values are added later, use the operating system keychain and do not include values in exports/logs.

## 12. Internal API / IPC outline

- `list_projects()`, `add_project(folder, metadata)`, `update_project(id, fields)`, `remove_project(id)`
- `open_project_folder(id)`, `open_project_url(id)`
- `preview_launch(id)` returns exact executable/args/cwd with secrets redacted
- `start_project(id)` validates configuration, starts a non-elevated app-owned child, returns run id
- `stop_run(run_id)` stops only owned child/process group
- `subscribe_run_output(run_id)` streams bounded text chunks
- `get_run_status(run_id)` returns status and exit code
- `export_config()` / `import_config(file)` with safe command-disable behavior

IPC handlers validate IDs and fields independently; UI validation is not a security boundary. Never expose a generic `exec(command)` IPC function.

## 13. Security and privacy

This product can execute local code, so its trust boundary is central. Use a narrow IPC surface; validate all input in native code; use native file pickers; avoid shell interpolation; never elevate; never kill unowned processes; bound and sanitize output; redact secrets; protect local config files; and review update signing. Treat project folders, README files, environment files, imported data, and process output as untrusted. Do not read `.env` or source code. Explain that configured commands run with the user's normal account permissions. Add explicit confirmation for first run and edits to an existing command.

## 14. Acceptance criteria

- User can add and reopen a project folder and URL without uploading its contents.
- User sees the precise command and working directory before launch.
- App starts a configured process without blocking the UI, displays bounded output/status, and stops only the process it launched.
- Removing a project never deletes or modifies its source directory.
- Restarting the app does not run commands automatically.
- An imported config cannot silently execute its commands.
- No generic shell execution endpoint is exposed to the frontend.
- Local settings can be exported, removed, and recreated; core paths are keyboard accessible.
