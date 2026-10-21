import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { Store } from './store';
import { ProcessSupervisor } from './processSupervisor';
import { Project, ProjectWithState, LaunchPreview } from '../src/types';

let mainWindow: BrowserWindow | null = null;
let store: Store;
let supervisor: ProcessSupervisor;

function isValidHttpUrl(stringUrl: string): boolean {
  try {
    const parsed = new URL(stringUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

function createWindow(): void {
  store = new Store();
  supervisor = new ProcessSupervisor(store, () => mainWindow);

  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 920,
    minHeight: 640,
    backgroundColor: '#0a0d14',
    title: 'Localhost — Developer Control Center',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  // Safe window open handler: never open popups or new windows in webview
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isValidHttpUrl(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Safe navigation handler
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://localhost:5173') && !url.startsWith('file://')) {
      event.preventDefault();
      if (isValidHttpUrl(url)) {
        shell.openExternal(url);
      }
    }
  });

  const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Register all IPC handlers
function setupIpc(): void {
  // 1. Get user data dir
  ipcMain.handle('localhost:get-data-dir', async () => {
    return store.getDataDir();
  });

  // 2. Select folder via native dialog
  ipcMain.handle('localhost:select-folder', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Project Directory',
      properties: ['openDirectory'],
      buttonLabel: 'Select Folder'
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const selected = result.filePaths[0];
    try {
      return fs.realpathSync(selected);
    } catch {
      return path.resolve(selected);
    }
  });

  // 3. List projects with active run state & path validation
  ipcMain.handle('localhost:list-projects', async (): Promise<ProjectWithState[]> => {
    const rawProjects = store.getProjects();
    const enriched: ProjectWithState[] = rawProjects.map(proj => {
      let pathExists = false;
      try {
        pathExists = fs.existsSync(proj.canonical_path) && fs.statSync(proj.canonical_path).isDirectory();
      } catch {
        pathExists = false;
      }

      const activeRun = supervisor.getActiveRunForProject(proj.id);

      return {
        ...proj,
        path_exists: pathExists,
        active_run: activeRun
      };
    });

    return enriched;
  });

  // 4. Add project
  ipcMain.handle('localhost:add-project', async (_event, data: Omit<Project, 'id' | 'created_at' | 'updated_at' | 'archived_at'>) => {
    try {
      const name = data.name?.trim();
      if (!name) {
        return { success: false, error: 'Project name is required.' };
      }

      const folderPath = data.canonical_path?.trim();
      if (!folderPath) {
        return { success: false, error: 'Project folder path is required.' };
      }

      if (!fs.existsSync(folderPath)) {
        return { success: false, error: `Directory does not exist on disk: ${folderPath}` };
      }

      let canonical: string;
      try {
        canonical = fs.realpathSync(folderPath);
      } catch {
        canonical = path.resolve(folderPath);
      }

      // Check duplicates
      const existing = store.getProjects();
      const duplicatePath = existing.find(p => p.canonical_path.toLowerCase() === canonical.toLowerCase());
      if (duplicatePath) {
        return {
          success: false,
          error: `A project ("${duplicatePath.name}") is already registered at this folder path.`
        };
      }

      // Validate dev_url if present
      let cleanUrl: string | null = null;
      if (data.dev_url && data.dev_url.trim()) {
        const urlCandidate = data.dev_url.trim();
        if (!isValidHttpUrl(urlCandidate)) {
          return { success: false, error: 'Development URL must be a valid http:// or https:// URL.' };
        }
        cleanUrl = urlCandidate;
      }

      const newProject: Project = {
        id: `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name,
        canonical_path: canonical,
        dev_url: cleanUrl,
        executable: data.executable?.trim() || null,
        args: Array.isArray(data.args) ? data.args.map(a => a.trim()).filter(Boolean) : [],
        working_directory: data.working_directory?.trim() || null,
        tags: Array.isArray(data.tags) ? data.tags.map(t => t.trim().toLowerCase()).filter(Boolean) : [],
        is_shell_mode: Boolean(data.is_shell_mode),
        command_disabled: Boolean(data.command_disabled),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        archived_at: null
      };

      const updatedList = [newProject, ...existing];
      store.saveProjects(updatedList);

      store.addAuditEvent({
        event_type: 'project_added',
        project_id: newProject.id,
        project_name: newProject.name,
        details: `Registered project "${newProject.name}" at ${canonical}`
      });

      return { success: true, project: newProject };
    } catch (err: any) {
      console.error('[IPC] add-project error:', err);
      return { success: false, error: err.message || 'Failed to add project.' };
    }
  });

  // 5. Update project
  ipcMain.handle('localhost:update-project', async (_event, id: string, partial: Partial<Project>) => {
    try {
      const projects = store.getProjects();
      const index = projects.findIndex(p => p.id === id);
      if (index === -1) {
        return { success: false, error: 'Project not found.' };
      }

      const current = projects[index];

      // Validate URL if provided
      let cleanUrl = current.dev_url;
      if (partial.dev_url !== undefined) {
        if (partial.dev_url && partial.dev_url.trim()) {
          const urlCandidate = partial.dev_url.trim();
          if (!isValidHttpUrl(urlCandidate)) {
            return { success: false, error: 'Development URL must be a valid http:// or https:// URL.' };
          }
          cleanUrl = urlCandidate;
        } else {
          cleanUrl = null;
        }
      }

      const updated: Project = {
        ...current,
        ...partial,
        dev_url: cleanUrl,
        updated_at: new Date().toISOString()
      };

      projects[index] = updated;
      store.saveProjects(projects);

      store.addAuditEvent({
        event_type: 'project_updated',
        project_id: updated.id,
        project_name: updated.name,
        details: `Updated settings for "${updated.name}"`
      });

      return { success: true, project: updated };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update project.' };
    }
  });

  // 6. Remove project (never deletes source folder!)
  ipcMain.handle('localhost:remove-project', async (_event, id: string) => {
    try {
      const projects = store.getProjects();
      const target = projects.find(p => p.id === id);
      if (!target) {
        return { success: false, error: 'Project not found.' };
      }

      // If active run, stop process first
      const activeRun = supervisor.getActiveRunForProject(id);
      if (activeRun) {
        await supervisor.stopRun(activeRun.id);
      }

      const filtered = projects.filter(p => p.id !== id);
      store.saveProjects(filtered);

      store.addAuditEvent({
        event_type: 'project_removed',
        project_id: id,
        project_name: target.name,
        details: `Removed project card for "${target.name}". Source folder preserved untouched at ${target.canonical_path}.`
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to remove project.' };
    }
  });

  // 7. Open folder in native file manager
  ipcMain.handle('localhost:open-folder', async (_event, id: string) => {
    const projects = store.getProjects();
    const proj = projects.find(p => p.id === id);
    if (!proj) return { success: false, error: 'Project not found.' };

    if (!fs.existsSync(proj.canonical_path)) {
      return { success: false, error: `Folder no longer exists on disk: ${proj.canonical_path}` };
    }

    try {
      const result = await shell.openPath(proj.canonical_path);
      if (result) {
        // Non-empty string means error opening path
        return { success: false, error: result };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 8. Open URL in default browser
  ipcMain.handle('localhost:open-url', async (_event, id: string) => {
    const projects = store.getProjects();
    const proj = projects.find(p => p.id === id);
    if (!proj) return { success: false, error: 'Project not found.' };

    if (!proj.dev_url || !isValidHttpUrl(proj.dev_url)) {
      return { success: false, error: 'No valid HTTP(S) URL configured for this project.' };
    }

    try {
      await shell.openExternal(proj.dev_url);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 9. Preview launch configuration
  ipcMain.handle('localhost:preview-launch', async (_event, id: string): Promise<LaunchPreview> => {
    const projects = store.getProjects();
    const proj = projects.find(p => p.id === id);
    if (!proj) {
      throw new Error('Project not found');
    }

    const exec = proj.executable || '';
    const args = Array.isArray(proj.args) ? proj.args : [];
    const cwd = proj.working_directory || proj.canonical_path;
    const warnings: string[] = [];

    const pathExists = fs.existsSync(cwd);
    if (!pathExists) {
      warnings.push(`Working directory does not exist: ${cwd}`);
    }

    if (proj.command_disabled) {
      warnings.push('Command execution is currently disabled for this project.');
    }

    if (proj.is_shell_mode) {
      warnings.push('Shell mode is active: commands will be evaluated through the OS shell.');
    }

    return {
      executable: exec,
      args,
      working_directory: cwd,
      is_shell_mode: proj.is_shell_mode,
      command_line_preview: `${exec} ${args.join(' ')}`.trim(),
      command_disabled: proj.command_disabled,
      path_exists: pathExists,
      warnings
    };
  });

  // 10. Start process
  ipcMain.handle('localhost:start-project', async (_event, id: string) => {
    const projects = store.getProjects();
    const proj = projects.find(p => p.id === id);
    if (!proj) return { success: false, error: 'Project not found.' };

    return supervisor.startProject(proj);
  });

  // 11. Stop process run
  ipcMain.handle('localhost:stop-run', async (_event, runId: string) => {
    return supervisor.stopRun(runId);
  });

  // 12. Get process runs
  ipcMain.handle('localhost:get-runs', async () => {
    return supervisor.getRuns();
  });

  // 13. Get output ring buffer
  ipcMain.handle('localhost:get-run-output', async (_event, runId: string) => {
    return supervisor.getRunOutput(runId);
  });

  // 14. Settings
  ipcMain.handle('localhost:get-settings', async () => {
    return store.getSettings();
  });

  ipcMain.handle('localhost:update-settings', async (_event, partial) => {
    const updated = store.updateSettings(partial);
    store.addAuditEvent({
      event_type: 'settings_updated',
      project_id: null,
      project_name: null,
      details: 'Updated app settings'
    });
    return { success: true, settings: updated };
  });

  // 15. Audit Log
  ipcMain.handle('localhost:get-audit-log', async () => {
    return store.getAuditEvents();
  });

  // 16. Export Configuration
  ipcMain.handle('localhost:export-config', async () => {
    const projects = store.getProjects().map(p => ({
      name: p.name,
      canonical_path: p.canonical_path,
      dev_url: p.dev_url,
      executable: p.executable,
      args: p.args,
      working_directory: p.working_directory,
      tags: p.tags,
      is_shell_mode: p.is_shell_mode
    }));

    const settings = store.getSettings();

    const exportPayload = {
      app: 'Localhost Developer Control Center',
      exported_at: new Date().toISOString(),
      schema_version: 1,
      projects,
      settings
    };

    store.addAuditEvent({
      event_type: 'config_exported',
      project_id: null,
      project_name: null,
      details: `Exported ${projects.length} project definitions.`
    });

    return JSON.stringify(exportPayload, null, 2);
  });

  // 17. Safe Import Configuration
  ipcMain.handle('localhost:import-config', async (_event, jsonContent: string) => {
    try {
      const parsed = JSON.parse(jsonContent);
      if (!parsed || !Array.isArray(parsed.projects)) {
        return { success: false, importedCount: 0, message: 'Invalid configuration format: missing projects array.' };
      }

      const existing = store.getProjects();
      const existingPaths = new Set(existing.map(p => p.canonical_path.toLowerCase()));
      let added = 0;

      for (const item of parsed.projects) {
        if (!item.name || !item.canonical_path) continue;

        // Skip if already exists
        if (existingPaths.has(item.canonical_path.toLowerCase())) {
          continue;
        }

        // CRITICAL SECURITY REQUIREMENT:
        // Imported commands MUST be marked command_disabled: true
        // and require explicit review by the user before running!
        const importedProject: Project = {
          id: `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: String(item.name).slice(0, 100),
          canonical_path: String(item.canonical_path),
          dev_url: item.dev_url && isValidHttpUrl(item.dev_url) ? item.dev_url : null,
          executable: item.executable ? String(item.executable) : null,
          args: Array.isArray(item.args) ? item.args.map((a: any) => String(a)) : [],
          working_directory: item.working_directory ? String(item.working_directory) : null,
          tags: Array.isArray(item.tags) ? item.tags.map((t: any) => String(t)) : [],
          is_shell_mode: Boolean(item.is_shell_mode),
          command_disabled: true, // ALWAYS DISABLED ON IMPORT FOR SECURITY
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          archived_at: null
        };

        existing.unshift(importedProject);
        existingPaths.add(importedProject.canonical_path.toLowerCase());
        added++;
      }

      store.saveProjects(existing);

      store.addAuditEvent({
        event_type: 'config_imported',
        project_id: null,
        project_name: null,
        details: `Imported ${added} projects. All imported launch commands have been set to disabled for safety.`
      });

      return {
        success: true,
        importedCount: added,
        message: `Successfully imported ${added} projects. Launch commands are disabled by default for safety until you review them.`
      };
    } catch (err: any) {
      return { success: false, importedCount: 0, message: `Failed to import configuration: ${err.message}` };
    }
  });

  // 18. Clear all data
  ipcMain.handle('localhost:clear-all-data', async () => {
    supervisor.terminateAllActive();
    store.clearAll();
    store.addAuditEvent({
      event_type: 'data_cleared',
      project_id: null,
      project_name: null,
      details: 'Cleared all Localhost metadata. No project directories were touched.'
    });
    return { success: true };
  });
}

// App lifecycle
app.whenReady().then(() => {
  setupIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', (e) => {
  const activeCount = supervisor ? supervisor.getActiveCount() : 0;
  if (activeCount > 0 && store) {
    const settings = store.getSettings();
    if (settings.terminate_children_on_exit) {
      console.log(`[Main] Terminating ${activeCount} app-owned child processes on exit...`);
      supervisor.terminateAllActive();
    }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
