import { LocalhostApi, Project, ProjectWithState, ProcessRun, OutputChunk, AppSettings, AuditEvent, LaunchPreview } from '../types';

const STORAGE_KEY = 'localhost_browser_mock_projects';

const INITIAL_PROJECTS: Project[] = [
  {
    id: 'proj_sample_nextjs',
    name: 'E-Commerce Storefront',
    canonical_path: 'C:\\Users\\Developer\\Projects\\storefront-web',
    dev_url: 'http://localhost:3000',
    executable: 'npm',
    args: ['run', 'dev'],
    working_directory: null,
    tags: ['frontend', 'nextjs', 'typescript'],
    is_shell_mode: false,
    command_disabled: false,
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    updated_at: new Date().toISOString(),
    archived_at: null
  },
  {
    id: 'proj_sample_fastapi',
    name: 'Inventory & Auth API',
    canonical_path: 'C:\\Users\\Developer\\Projects\\inventory-api',
    dev_url: 'http://localhost:8000/docs',
    executable: 'python',
    args: ['-m', 'uvicorn', 'main:app', '--reload', '--port', '8000'],
    working_directory: null,
    tags: ['backend', 'python', 'fastapi'],
    is_shell_mode: false,
    command_disabled: false,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    updated_at: new Date().toISOString(),
    archived_at: null
  },
  {
    id: 'proj_sample_docs',
    name: 'Developer Documentation Portal',
    canonical_path: 'C:\\Users\\Developer\\Projects\\docs-portal',
    dev_url: 'http://localhost:4000',
    executable: 'npm',
    args: ['run', 'docs:serve'],
    working_directory: null,
    tags: ['docs', 'astro'],
    is_shell_mode: false,
    command_disabled: true, // Example imported project with command disabled for security review
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    archived_at: null
  }
];

export function setupMockApiIfNeeded(): void {
  if (typeof window === 'undefined' || window.localhostApi) {
    return;
  }

  console.log('[MockApi] Electron preload not detected. Initializing browser mock layer for Localhost Developer Control Center.');

  const loadProjects = (): Project[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_PROJECTS));
    return INITIAL_PROJECTS;
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
      const randomId = Math.floor(Math.random() * 900 + 100);
      return `C:\\Users\\Developer\\Projects\\sample-app-${randomId}`;
    },

    listProjects: async (): Promise<ProjectWithState[]> => {
      const projs = loadProjects();
      return projs.map(p => ({
        ...p,
        path_exists: !p.canonical_path.includes('missing'),
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
      console.log(`[MockApi] Opening folder: ${p?.canonical_path}`);
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
        },
        {
          runId,
          text: `[info] Service starting up on port...\n[info] Ready in 450ms.\n`,
          stream: 'stdout',
          timestamp: new Date().toISOString()
        }
      ]);

      // Simulate periodic log ticks
      let tick = 0;
      const interval = setInterval(() => {
        tick++;
        const sampleLogs = [
          `[GET] /api/health - 200 OK (2ms)\n`,
          `[GET] /assets/index.js - 304 Not Modified\n`,
          `[WS] Client connection established from 127.0.0.1:54322\n`,
          `[debug] Memory usage: 48.2 MB heap\n`
        ];
        const logText = sampleLogs[tick % sampleLogs.length];
        const chunk: OutputChunk = {
          runId,
          text: logText,
          stream: 'stdout',
          timestamp: new Date().toISOString()
        };
        outputBuffers.get(runId)?.push(chunk);
        outputListeners.forEach(cb => cb(chunk));
      }, 3000);

      activeIntervals.set(runId, interval);
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

    getAuditLog: async (): Promise<AuditEvent[]> => [
      {
        id: 'evt_1',
        event_type: 'project_added',
        project_id: 'proj_sample_nextjs',
        project_name: 'E-Commerce Storefront',
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
        details: 'Registered project "E-Commerce Storefront"'
      },
      {
        id: 'evt_2',
        event_type: 'config_imported',
        project_id: null,
        project_name: null,
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        details: 'Imported docs-portal. Command marked disabled for security review.'
      }
    ],

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
