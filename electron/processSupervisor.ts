import { spawn, ChildProcess } from 'child_process';
import { BrowserWindow } from 'electron';
import { ProcessRun, OutputChunk, Project } from '../src/types';
import { Store } from './store';

interface ActiveProcessEntry {
  run: ProcessRun;
  process: ChildProcess;
  outputBuffer: OutputChunk[];
  totalBytes: number;
}

export class ProcessSupervisor {
  private activeProcesses = new Map<string, ActiveProcessEntry>();
  private completedRuns: ProcessRun[] = [];
  private runOutputHistory = new Map<string, OutputChunk[]>();
  private maxOutputBytes = 5 * 1024 * 1024; // 5 MB per process
  private maxBufferLines = 2000;
  private getMainWindow: () => BrowserWindow | null;
  private store: Store;

  constructor(store: Store, getMainWindow: () => BrowserWindow | null) {
    this.store = store;
    this.getMainWindow = getMainWindow;
  }

  public getRuns(): ProcessRun[] {
    const active = Array.from(this.activeProcesses.values()).map(e => ({ ...e.run }));
    return [...active, ...this.completedRuns];
  }

  public getRunById(runId: string): ProcessRun | undefined {
    const active = this.activeProcesses.get(runId);
    if (active) return { ...active.run };
    return this.completedRuns.find(r => r.id === runId);
  }

  public getActiveRunForProject(projectId: string): ProcessRun | null {
    for (const entry of this.activeProcesses.values()) {
      if (entry.run.project_id === projectId && entry.run.status === 'running_by_app') {
        return { ...entry.run };
      }
    }
    return null;
  }

  public getRunOutput(runId: string): OutputChunk[] {
    const active = this.activeProcesses.get(runId);
    if (active) {
      return [...active.outputBuffer];
    }
    return this.runOutputHistory.get(runId) || [];
  }

  public async startProject(project: Project): Promise<{ success: boolean; runId?: string; error?: string }> {
    // 1. Guard against duplicate running instances of same project
    const existing = this.getActiveRunForProject(project.id);
    if (existing) {
      return {
        success: false,
        error: `Project "${project.name}" is already running (PID: ${existing.pid}). Stop it first before starting a new run.`
      };
    }

    if (project.command_disabled) {
      return {
        success: false,
        error: `The command for "${project.name}" is disabled for security (e.g. from an import). Review and enable it in project settings first.`
      };
    }

    if (!project.executable || project.executable.trim().length === 0) {
      return {
        success: false,
        error: `No launch executable configured for "${project.name}". Configure one in project settings.`
      };
    }

    const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const workingDir = project.working_directory?.trim() || project.canonical_path;
    const cleanExec = project.executable.trim();
    const cleanArgs = Array.isArray(project.args) ? project.args : [];

    const commandPreview = `${cleanExec} ${cleanArgs.join(' ')}`.trim();

    const runRecord: ProcessRun = {
      id: runId,
      project_id: project.id,
      pid: null,
      started_at: new Date().toISOString(),
      ended_at: null,
      status: 'running_by_app',
      exit_code: null,
      command_preview: commandPreview,
      working_directory: workingDir
    };

    try {
      // On Windows, commands like npm, npx, yarn, pnpm are .cmd batch scripts
      // that require shell: true in Node.js, otherwise spawn throws ENOENT / EINVAL.
      const isWindows = process.platform === 'win32';
      const execLower = cleanExec.toLowerCase();
      const isBatchCommand = isWindows && (
        ['npm', 'npx', 'yarn', 'pnpm', 'corepack'].includes(execLower) ||
        execLower.endsWith('.cmd') ||
        execLower.endsWith('.bat')
      );
      const useShell = project.is_shell_mode === true || isBatchCommand;

      const child = spawn(cleanExec, cleanArgs, {
        cwd: workingDir,
        env: { ...process.env },
        shell: useShell,
        windowsHide: true
      });

      // IMPORTANT: Register error handler immediately to prevent uncaught error events
      child.on('error', (err: Error) => {
        console.error(`[ProcessSupervisor] Process error on run ${runId}:`, err);
        this.appendOutput(runId, `\n[System Error] ${err.message}\n`, 'system');
        this.finalizeRun(runId, 'failed_to_start', null, err.message);
      });

      if (!child.pid) {
        throw new Error('Failed to obtain a valid Process ID from the operating system.');
      }

      runRecord.pid = child.pid;

      const entry: ActiveProcessEntry = {
        run: runRecord,
        process: child,
        outputBuffer: [],
        totalBytes: 0
      };

      this.activeProcesses.set(runId, entry);

      // Audit log
      this.store.addAuditEvent({
        event_type: 'process_started',
        project_id: project.id,
        project_name: project.name,
        details: `Started process PID ${child.pid}: ${commandPreview} in ${workingDir}`
      });

      this.emitStatusChange(runRecord);

      // Add system announcement banner to log
      this.appendOutput(runId, `--- Process started at ${runRecord.started_at} (PID: ${child.pid}) ---\nCommand: ${commandPreview}\nWorking Dir: ${workingDir}\nShell Mode: ${useShell ? 'Enabled' : 'Direct execution'}\n----------------------------------------------------\n`, 'system');

      // Setup stdout/stderr handlers
      if (child.stdout) {
        child.stdout.on('data', (data: Buffer) => {
          this.appendOutput(runId, data.toString('utf-8'), 'stdout');
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (data: Buffer) => {
          this.appendOutput(runId, data.toString('utf-8'), 'stderr');
        });
      }

      child.on('close', (code: number | null) => {
        this.appendOutput(runId, `\n--- Process exited with code ${code ?? 'unknown'} at ${new Date().toISOString()} ---\n`, 'system');
        this.finalizeRun(runId, 'exited', code);
      });

      return { success: true, runId };
    } catch (err: any) {
      console.error(`[ProcessSupervisor] Spawn exception for project ${project.name}:`, err);
      runRecord.status = 'failed_to_start';
      runRecord.ended_at = new Date().toISOString();
      runRecord.error_message = err.message || 'Unknown spawn error';
      this.completedRuns.unshift(runRecord);
      this.emitStatusChange(runRecord);

      this.store.addAuditEvent({
        event_type: 'process_failed',
        project_id: project.id,
        project_name: project.name,
        details: `Failed to launch ${commandPreview}: ${err.message}`
      });

      return {
        success: false,
        error: `Could not launch "${commandPreview}": ${err.message}`
      };
    }
  }

  public async stopRun(runId: string): Promise<{ success: boolean; error?: string }> {
    const entry = this.activeProcesses.get(runId);
    if (!entry) {
      return { success: false, error: 'Process is not active or was not spawned by Localhost.' };
    }

    const { process: child, run } = entry;
    const pid = run.pid;

    if (!pid) {
      return { success: false, error: 'No PID associated with this active process.' };
    }

    this.appendOutput(runId, `\n[System] Stop requested by user. Terminating process tree for PID ${pid}...\n`, 'system');

    try {
      // Safe, explicit termination of ONLY this app-owned child process and its child tree
      if (process.platform === 'win32') {
        // Use Windows taskkill for process tree termination of app-owned PID
        spawn('taskkill', ['/pid', pid.toString(), '/T', '/F'], { windowsHide: true });
      } else {
        child.kill('SIGTERM');
        // Force kill after 3 seconds if not terminated
        setTimeout(() => {
          if (this.activeProcesses.has(runId)) {
            child.kill('SIGKILL');
          }
        }, 3000);
      }

      this.store.addAuditEvent({
        event_type: 'process_stopped',
        project_id: run.project_id,
        project_name: null,
        details: `Stopped process PID ${pid} (${run.command_preview})`
      });

      return { success: true };
    } catch (err: any) {
      console.error(`[ProcessSupervisor] Error stopping process ${pid}:`, err);
      return { success: false, error: `Failed to terminate process ${pid}: ${err.message}` };
    }
  }

  private appendOutput(runId: string, text: string, stream: 'stdout' | 'stderr' | 'system'): void {
    const entry = this.activeProcesses.get(runId);
    if (!entry) return;

    const chunk: OutputChunk = {
      runId,
      text,
      stream,
      timestamp: new Date().toISOString()
    };

    entry.outputBuffer.push(chunk);
    entry.totalBytes += Buffer.byteLength(text, 'utf-8');

    // Cap output buffer: enforce max lines and max bytes (e.g. 5 MB)
    if (entry.totalBytes > this.maxOutputBytes || entry.outputBuffer.length > this.maxBufferLines) {
      while (
        (entry.totalBytes > this.maxOutputBytes || entry.outputBuffer.length > this.maxBufferLines) &&
        entry.outputBuffer.length > 100
      ) {
        const removed = entry.outputBuffer.shift();
        if (removed) {
          entry.totalBytes -= Buffer.byteLength(removed.text, 'utf-8');
        }
      }
    }

    // Stream to renderer via IPC
    const win = this.getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('process-output', chunk);
    }
  }

  private finalizeRun(runId: string, status: 'exited' | 'failed_to_start', exitCode: number | null, errorMessage?: string): void {
    const entry = this.activeProcesses.get(runId);
    if (!entry) return;

    const { run } = entry;
    run.status = status;
    run.exit_code = exitCode;
    run.ended_at = new Date().toISOString();
    if (errorMessage) {
      run.error_message = errorMessage;
    }

    // Move to history
    this.completedRuns.unshift({ ...run });
    if (this.completedRuns.length > 50) {
      const removed = this.completedRuns.pop();
      if (removed) {
        this.runOutputHistory.delete(removed.id);
      }
    }

    // Store bounded history of the output
    this.runOutputHistory.set(runId, [...entry.outputBuffer]);
    this.activeProcesses.delete(runId);

    this.emitStatusChange(run);

    this.store.addAuditEvent({
      event_type: 'process_exited',
      project_id: run.project_id,
      project_name: null,
      details: `Process PID ${run.pid} ended with status ${status} (exit code: ${exitCode ?? 'none'})`
    });
  }

  private emitStatusChange(run: ProcessRun): void {
    const win = this.getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('process-status-change', { ...run });
    }
  }

  public terminateAllActive(): void {
    for (const [runId, entry] of this.activeProcesses.entries()) {
      const pid = entry.run.pid;
      if (pid) {
        try {
          if (process.platform === 'win32') {
            spawn('taskkill', ['/pid', pid.toString(), '/T', '/F'], { windowsHide: true });
          } else {
            entry.process.kill('SIGTERM');
          }
        } catch (e) {
          console.error(`[ProcessSupervisor] Error during cleanup of PID ${pid}:`, e);
        }
      }
    }
    this.activeProcesses.clear();
  }

  public getActiveCount(): number {
    return this.activeProcesses.size;
  }
}
