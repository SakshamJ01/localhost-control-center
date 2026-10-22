import { LocalhostApi, Project, ProjectWithState, ProcessRun, OutputChunk, AppSettings, AuditEvent, LaunchPreview, DetectedScript, ProjectDetection } from '../types';

const STORAGE_KEY = 'localhost_browser_mock_projects';
const AUDIT_KEY = 'localhost_browser_mock_audit';

export function setupMockApiIfNeeded(): void {
  if (typeof window === 'undefined' || window.localhostApi) {
    return;
  }

  const loadProjects = (): Project[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: Project[] = JSON.parse(raw);
        // Automatically purge any dummy test projects from older sessions
        const cleaned = parsed.filter(p => !p.id.startsWith('proj_sample_'));
        if (cleaned.length !== parsed.length) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
        }
        return cleaned;
      }
    } catch {}
    return [];
  };

  const saveProjects = (projects: Project[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  };

  const activeRuns = new Map<string, ProcessRun>();
  const outputBuffers = new Map<string, OutputChunk[]>();
  const outputListeners = new Set<(chunk: OutputChunk) => void>();
  const statusListeners = new Set<(run: ProcessRun) => void>();
  const activeIntervals = new Map<string, any>();

  const mockApi: LocalhostApi = {
    getDataDir: async () => 'C:\\Users\\Developer\\AppData\\Roaming\\Localhost',

    selectFolder: async () => {
      // Use modern browser native directory picker if available
      if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
        try {
          const handle = await (window as any).showDirectoryPicker();
          if (handle && handle.name) {
            (window as any).__lastSelectedDirHandle = handle;
            try {
              const pkgFileHandle = await handle.getFileHandle('package.json');
              const file = await pkgFileHandle.getFile();
              const text = await file.text();
              (window as any).__lastSelectedPackageJson = JSON.parse(text);
            } catch {
              (window as any).__lastSelectedPackageJson = null;
            }
            return `C:\\Users\\Saksham\\Documents\\${handle.name}`;
          }
        } catch (err: any) {
          if (err.name === 'AbortError') {
            return null;
          }
          console.warn('showDirectoryPicker error:', err);
        }
      }
      return null;
    },

    detectProject: async (folderPath: string): Promise<ProjectDetection | null> => {
      if (!folderPath) return null;
      const lower = folderPath.toLowerCase();
      const base = folderPath.replace(/[\\/]$/, '').split(/[\\/]/).pop() || 'My App';

      const livePkg = (window as any).__lastSelectedPackageJson;
      if (livePkg && typeof livePkg === 'object') {
        const scripts = livePkg.scripts || {};
        const availableScripts: DetectedScript[] = [];
        const scriptKeys = Object.keys(scripts);

        for (const key of scriptKeys) {
          const raw = String(scripts[key]);
          const fullCommand = key === 'start' || key === 'test' ? `npm ${key}` : `npm run ${key}`;
          const args = key === 'start' || key === 'test' ? [key] : ['run', key];
          availableScripts.push({
            id: `script_${key}`,
            name: key,
            command: raw,
            executable: 'npm',
            args,
            full_command: fullCommand,
            is_recommended: false
          });
        }

        const priorityKeys = ['dev', 'start:dev', 'serve', 'develop', 'start'];
        let recommendedKey = priorityKeys.find(k => scripts[k] !== undefined) || scriptKeys[0];
        let recommendedScript = availableScripts.find(s => s.name === recommendedKey) || null;
        if (recommendedScript) recommendedScript.is_recommended = true;

        const allDeps = { ...(livePkg.dependencies || {}), ...(livePkg.devDependencies || {}) };
        let framework = 'Node.js App';
        let suggestedDevUrl: string | null = 'http://localhost:3000';
        const tags: string[] = ['node'];

        if (allDeps['next']) {
          framework = 'Next.js App';
          suggestedDevUrl = 'http://localhost:3000';
          tags.push('nextjs', 'react');
        } else if (allDeps['vite']) {
          framework = 'Vite App';
          suggestedDevUrl = 'http://localhost:5173';
          tags.push('vite', 'react');
        } else if (allDeps['react-scripts']) {
          framework = 'Create React App';
          suggestedDevUrl = 'http://localhost:3000';
          tags.push('react');
        }

        return {
          framework,
          project_type: 'node' as const,
          suggested_name: livePkg.name || base,
          suggested_dev_url: suggestedDevUrl,
          suggested_tags: tags,
          package_manager: 'npm' as const,
          available_scripts: availableScripts,
          recommended_script: recommendedScript
        };
      }

      if (lower.includes('brain dump') || lower.includes('clearstep') || lower.includes('next')) {
        return {
          framework: 'Next.js App',
          project_type: 'node' as const,
          suggested_name: 'clearstep',
          suggested_dev_url: 'http://localhost:3000',
          suggested_tags: ['nextjs', 'react', 'typescript'],
          package_manager: 'npm' as const,
          available_scripts: [
            { id: 'script_dev', name: 'dev', command: 'next dev', executable: 'npm', args: ['run', 'dev'], full_command: 'npm run dev', is_recommended: true },
            { id: 'script_build', name: 'build', command: 'next build', executable: 'npm', args: ['run', 'build'], full_command: 'npm run build', is_recommended: false },
            { id: 'script_start', name: 'start', command: 'next start', executable: 'npm', args: ['start'], full_command: 'npm start', is_recommended: false },
            { id: 'script_test', name: 'test', command: 'vitest run', executable: 'npm', args: ['test'], full_command: 'npm test', is_recommended: false }
          ],
          recommended_script: { id: 'script_dev', name: 'dev', command: 'next dev', executable: 'npm', args: ['run', 'dev'], full_command: 'npm run dev', is_recommended: true }
        };
      }

      if (lower.includes('vite') || lower.includes('react')) {
        return {
          framework: 'React (Vite) App',
          project_type: 'node' as const,
          suggested_name: base,
          suggested_dev_url: 'http://localhost:5173',
          suggested_tags: ['vite', 'react'],
          package_manager: 'npm' as const,
          available_scripts: [
            { id: 'script_dev', name: 'dev', command: 'vite', executable: 'npm', args: ['run', 'dev'], full_command: 'npm run dev', is_recommended: true },
            { id: 'script_build', name: 'build', command: 'vite build', executable: 'npm', args: ['run', 'build'], full_command: 'npm run build', is_recommended: false },
            { id: 'script_preview', name: 'preview', command: 'vite preview', executable: 'npm', args: ['run', 'preview'], full_command: 'npm run preview', is_recommended: false }
          ],
          recommended_script: { id: 'script_dev', name: 'dev', command: 'vite', executable: 'npm', args: ['run', 'dev'], full_command: 'npm run dev', is_recommended: true }
        };
      }

      return {
        framework: 'Node.js App',
        project_type: 'node' as const,
        suggested_name: base,
        suggested_dev_url: 'http://localhost:3000',
        suggested_tags: ['node'],
        package_manager: 'npm' as const,
        available_scripts: [
          { id: 'script_dev', name: 'dev', command: 'node server.js', executable: 'npm', args: ['run', 'dev'], full_command: 'npm run dev', is_recommended: true },
          { id: 'script_start', name: 'start', command: 'node server.js', executable: 'npm', args: ['start'], full_command: 'npm start', is_recommended: false }
        ],
        recommended_script: { id: 'script_dev', name: 'dev', command: 'node server.js', executable: 'npm', args: ['run', 'dev'], full_command: 'npm run dev', is_recommended: true }
      };
    },

    listProjects: async (): Promise<ProjectWithState[]> => {
      const projs = loadProjects();
      return projs.map(p => ({
        ...p,
        path_exists: true,
        active_run: activeRuns.get(p.id) || null
      }));
    },

    addProject: async (data) => {
      const projs = loadProjects();
      const newProj: Project = {
        id: `proj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: data.name,
        canonical_path: data.canonical_path,
        dev_url: data.dev_url,
        executable: data.executable,
        args: data.args,
        working_directory: data.working_directory,
        tags: data.tags,
        is_shell_mode: data.is_shell_mode,
        command_disabled: data.command_disabled,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        archived_at: null
      };
      saveProjects([newProj, ...projs]);
      return { success: true, project: newProj };
    },

    updateProject: async (id, data) => {
      const projs = loadProjects();
      const idx = projs.findIndex(p => p.id === id);
      if (idx === -1) return { success: false, error: 'Project not found' };
      projs[idx] = { ...projs[idx], ...data, updated_at: new Date().toISOString() };
      saveProjects(projs);
      return { success: true, project: projs[idx] };
    },

    removeProject: async (id) => {
      const projs = loadProjects();
      saveProjects(projs.filter(p => p.id !== id));
      if (activeRuns.has(id)) {
        mockApi.stopRun(activeRuns.get(id)!.id);
      }
      return { success: true };
    },

    openFolder: async (id) => {
      const projs = loadProjects();
      const p = projs.find(x => x.id === id);
      console.log(`[Browser Mock] Opening folder: ${p?.canonical_path}`);
      return { success: true };
    },

    openUrl: async (id) => {
      const projs = loadProjects();
      const p = projs.find(x => x.id === id);
      if (p?.dev_url) {
        window.open(p.dev_url, '_blank');
      }
      return { success: true };
    },

    previewLaunch: async (id): Promise<LaunchPreview> => {
      const projs = loadProjects();
      const p = projs.find(x => x.id === id);
      if (!p) throw new Error('Not found');
      return {
        executable: p.executable || '',
        args: p.args || [],
        working_directory: p.working_directory || p.canonical_path,
        is_shell_mode: p.is_shell_mode,
        command_line_preview: `${p.executable} ${(p.args || []).join(' ')}`.trim(),
        command_disabled: p.command_disabled,
        path_exists: true,
        warnings: p.command_disabled ? ['Command disabled for security review.'] : []
      };
    },

    startProject: async (id) => {
      const projs = loadProjects();
      const p = projs.find(x => x.id === id);
      if (!p) return { success: false, error: 'Project not found' };
      if (p.command_disabled) return { success: false, error: 'Command disabled for review.' };

      const runId = `run_${Date.now()}`;
      const pid = Math.floor(Math.random() * 40000 + 1000);
      const cmdPreview = `${p.executable} ${(p.args || []).join(' ')}`.trim();

      const run: ProcessRun = {
        id: runId,
        project_id: p.id,
        pid,
        started_at: new Date().toISOString(),
        ended_at: null,
        status: 'running_by_app',
        exit_code: null,
        command_preview: cmdPreview,
        working_directory: p.working_directory || p.canonical_path
      };

      activeRuns.set(p.id, run);
      outputBuffers.set(runId, [
        {
          runId,
          text: `[Localhost] Spawning app-owned child PID ${pid}\nCommand: ${cmdPreview}\nWorking Dir: ${run.working_directory}\n----------------------------------------\n`,
          stream: 'system',
          timestamp: new Date().toISOString()
        }
      ]);

      statusListeners.forEach(cb => cb(run));
      return { success: true, runId };
    },

    stopRun: async (runId) => {
      let targetProjectId: string | null = null;
      for (const [projId, run] of activeRuns.entries()) {
        if (run.id === runId) {
          targetProjectId = projId;
          break;
        }
      }

      if (targetProjectId) {
        const run = activeRuns.get(targetProjectId)!;
        clearInterval(activeIntervals.get(runId));
        activeIntervals.delete(runId);

        run.status = 'exited';
        run.exit_code = 0;
        run.ended_at = new Date().toISOString();

        const stopChunk: OutputChunk = {
          runId,
          text: `\n[System] Process terminated by user request (PID: ${run.pid}).\n`,
          stream: 'system',
          timestamp: new Date().toISOString()
        };
        outputBuffers.get(runId)?.push(stopChunk);
        outputListeners.forEach(cb => cb(stopChunk));

        activeRuns.delete(targetProjectId);
        statusListeners.forEach(cb => cb(run));
      }

      return { success: true };
    },

    getRuns: async () => Array.from(activeRuns.values()),

    getRunOutput: async (runId) => outputBuffers.get(runId) || [],

    getSettings: async (): Promise<AppSettings> => ({
      schema_version: 1,
      log_retention_lines: 1000,
      max_output_mb: 5,
      terminate_children_on_exit: true,
      confirm_before_run: true
    }),

    updateSettings: async (settings) => ({
      success: true,
      settings: {
        schema_version: 1,
        log_retention_lines: 1000,
        max_output_mb: 5,
        terminate_children_on_exit: true,
        confirm_before_run: true,
        ...settings
      }
    }),

    getAuditLog: async (): Promise<AuditEvent[]> => {
      try {
        const raw = localStorage.getItem(AUDIT_KEY);
        if (raw) return JSON.parse(raw);
      } catch {}
      return [];
    },

    exportConfig: async () => {
      const projs = loadProjects();
      return JSON.stringify({
        app: 'Localhost Developer Control Center',
        exported_at: new Date().toISOString(),
        schema_version: 1,
        projects: projs
      }, null, 2);
    },

    importConfig: async (jsonContent) => {
      try {
        const parsed = JSON.parse(jsonContent);
        if (parsed.projects && Array.isArray(parsed.projects)) {
          const existing = loadProjects();
          const imported = parsed.projects.map((p: any) => ({
            ...p,
            id: `proj_import_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            command_disabled: true // ALWAYS DISABLED ON IMPORT FOR SECURITY
          }));
          saveProjects([...imported, ...existing]);
          return {
            success: true,
            importedCount: imported.length,
            message: `Successfully imported ${imported.length} projects. Commands are disabled for security review.`
          };
        }
      } catch (e: any) {
        return { success: false, importedCount: 0, message: e.message };
      }
      return { success: false, importedCount: 0, message: 'Invalid format' };
    },

    clearAllData: async () => {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(AUDIT_KEY);
      activeRuns.clear();
      outputBuffers.clear();
      return { success: true };
    },

    onProcessOutput: (callback) => {
      outputListeners.add(callback);
      return () => outputListeners.delete(callback);
    },

    onProcessStatusChange: (callback) => {
      statusListeners.add(callback);
      return () => statusListeners.delete(callback);
    }
  };

  window.localhostApi = mockApi;
}
