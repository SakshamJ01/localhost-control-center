import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { Project, AppSettings, AuditEvent } from '../src/types';

export interface StoreData {
  schema_version: number;
  projects: Project[];
  settings: AppSettings;
  audit_events: AuditEvent[];
}

const DEFAULT_SETTINGS: AppSettings = {
  schema_version: 1,
  log_retention_lines: 1000,
  max_output_mb: 5,
  terminate_children_on_exit: true,
  confirm_before_run: true
};

export class Store {
  private filePath: string;
  private data: StoreData;

  constructor() {
    const userDataPath = app.getPath('userData');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    this.filePath = path.join(userDataPath, 'localhost_store.json');
    this.data = this.load();
  }

  public getDataDir(): string {
    return app.getPath('userData');
  }

  private load(): StoreData {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          schema_version: parsed.schema_version || 1,
          projects: Array.isArray(parsed.projects) ? parsed.projects : [],
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
          audit_events: Array.isArray(parsed.audit_events) ? parsed.audit_events : []
        };
      }
    } catch (err) {
      console.error('[Store] Failed to parse local store file, initializing fallback:', err);
      // Backup corrupted file for developer recovery
      try {
        const backupPath = `${this.filePath}.corrupt-${Date.now()}`;
        if (fs.existsSync(this.filePath)) {
          fs.copyFileSync(this.filePath, backupPath);
        }
      } catch (backupErr) {
        console.error('[Store] Failed to backup corrupt store:', backupErr);
      }
    }

    return {
      schema_version: 1,
      projects: [],
      settings: DEFAULT_SETTINGS,
      audit_events: []
    };
  }

  private save(): void {
    try {
      const serialized = JSON.stringify(this.data, null, 2);
      const tempPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tempPath, serialized, 'utf-8');
      fs.renameSync(tempPath, this.filePath);
    } catch (err) {
      console.error('[Store] Failed to save store file atomically:', err);
      throw new Error(`Failed to persist application data: ${err}`);
    }
  }

  public getProjects(): Project[] {
    return [...this.data.projects];
  }

  public saveProjects(projects: Project[]): void {
    this.data.projects = projects;
    this.save();
  }

  public getSettings(): AppSettings {
    return { ...this.data.settings };
  }

  public updateSettings(partial: Partial<AppSettings>): AppSettings {
    this.data.settings = { ...this.data.settings, ...partial };
    this.save();
    return this.getSettings();
  }

  public getAuditEvents(): AuditEvent[] {
    return [...this.data.audit_events].slice(-200); // Keep last 200 events in memory
  }

  public addAuditEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): void {
    const newEvent: AuditEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...event
    };
    this.data.audit_events.unshift(newEvent);
    if (this.data.audit_events.length > 500) {
      this.data.audit_events = this.data.audit_events.slice(0, 500);
    }
    this.save();
  }

  public clearAll(): void {
    this.data = {
      schema_version: 1,
      projects: [],
      settings: DEFAULT_SETTINGS,
      audit_events: []
    };
    this.save();
  }
}
