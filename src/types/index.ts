export interface Project {
  id: string;
  name: string;
  canonical_path: string;
  dev_url: string | null;
  executable: string | null;
  args: string[];
  working_directory: string | null;
  tags: string[];
  is_shell_mode: boolean;
  command_disabled: boolean;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export type ProcessStatus = 'running_by_app' | 'exited' | 'failed_to_start' | 'unknown';

export interface ProcessRun {
  id: string;
  project_id: string;
  pid: number | null;
  started_at: string;
  ended_at: string | null;
  status: ProcessStatus;
  exit_code: number | null;
  command_preview: string;
  working_directory: string;
  error_message?: string;
}

export interface OutputChunk {
  runId: string;
  text: string;
  stream: 'stdout' | 'stderr' | 'system';
  timestamp: string;
}

export interface ProjectWithState extends Project {
  path_exists: boolean;
  active_run: ProcessRun | null;
}

export interface AppSettings {
  schema_version: number;
  log_retention_lines: number;
  max_output_mb: number;
  terminate_children_on_exit: boolean;
  confirm_before_run: boolean;
  ai_provider?: 'openrouter' | 'gemini' | 'openai';
  ai_api_key?: string;
  ai_model?: string;
}

export interface ProjectContext {
  folder_name: string;
  folder_path: string;
  files: string[];
  package_json?: string;
  readme?: string;
  env_example?: string;
}

export interface AIAnalysisResult {
  project_name: string;
  framework: string;
  summary: string;
  recommended_command: string;
  command_explanation: string;
  dev_url: string | null;
  prerequisites: string[];
  tags: string[];
  executable: string;
  args: string[];
  warnings?: string[];
}

export interface AuditEvent {
  id: string;
  event_type: 
    | 'project_added'
    | 'project_updated'
    | 'project_removed'
    | 'process_started'
    | 'process_stopped'
    | 'process_exited'
    | 'process_failed'
    | 'config_exported'
    | 'config_imported'
    | 'settings_updated'
    | 'data_cleared';
  project_id: string | null;
  project_name: string | null;
  timestamp: string;
  details: string;
}

export interface LaunchPreview {
  executable: string;
  args: string[];
  working_directory: string;
  is_shell_mode: boolean;
  command_line_preview: string;
  command_disabled: boolean;
  path_exists: boolean;
  warnings: string[];
}

export interface DetectedScript {
  id: string;
  name: string;
  command: string;
  executable: string;
  args: string[];
  full_command: string;
  is_recommended: boolean;
}

export interface ProjectDetection {
  framework: string;
  project_type: 'node' | 'python' | 'rust' | 'go' | 'static' | 'unknown';
  suggested_name: string;
  suggested_dev_url: string | null;
  suggested_tags: string[];
  package_manager: 'npm' | 'pnpm' | 'yarn' | 'bun' | 'python' | 'cargo' | 'go' | 'none';
  available_scripts: DetectedScript[];
  recommended_script: DetectedScript | null;
}

export interface LocalhostApi {
  getDataDir: () => Promise<string>;
  selectFolder: () => Promise<string | null>;
  detectProject: (folderPath: string) => Promise<ProjectDetection | null>;
  readProjectContext: (folderPath: string) => Promise<ProjectContext | null>;
  listProjects: () => Promise<ProjectWithState[]>;
  addProject: (data: Omit<Project, 'id' | 'created_at' | 'updated_at' | 'archived_at'>) => Promise<{ success: boolean; project?: Project; error?: string }>;
  updateProject: (id: string, data: Partial<Project>) => Promise<{ success: boolean; project?: Project; error?: string }>;
  removeProject: (id: string) => Promise<{ success: boolean; error?: string }>;
  openFolder: (id: string) => Promise<{ success: boolean; error?: string }>;
  openUrl: (id: string) => Promise<{ success: boolean; error?: string }>;
  previewLaunch: (id: string) => Promise<LaunchPreview>;
  startProject: (id: string) => Promise<{ success: boolean; runId?: string; error?: string }>;
  stopRun: (runId: string) => Promise<{ success: boolean; error?: string }>;
  getRuns: () => Promise<ProcessRun[]>;
  getRunOutput: (runId: string) => Promise<OutputChunk[]>;
  getSettings: () => Promise<AppSettings>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<{ success: boolean; settings: AppSettings }>;
  getAuditLog: () => Promise<AuditEvent[]>;
  exportConfig: () => Promise<string>;
  importConfig: (jsonContent: string) => Promise<{ success: boolean; importedCount: number; message: string; error?: string }>;
  clearAllData: () => Promise<{ success: boolean }>;
  onProcessOutput: (callback: (chunk: OutputChunk) => void) => () => void;
  onProcessStatusChange: (callback: (run: ProcessRun) => void) => () => void;
}

declare global {
  interface Window {
    localhostApi: LocalhostApi;
  }
}
