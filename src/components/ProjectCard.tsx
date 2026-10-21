import React, { useState } from 'react';
import { ProjectWithState } from '../types';
import { formatElapsedTime, truncatePath } from '../utils/formatters';
import { 
  Folder, 
  FolderOpen, 
  Globe, 
  Play, 
  Square, 
  Terminal, 
  Edit3, 
  Trash2, 
  AlertTriangle, 
  ExternalLink, 
  Copy, 
  Check, 
  ShieldAlert,
  Clock,
  Cpu
} from 'lucide-react';

interface ProjectCardProps {
  project: ProjectWithState;
  onStart: (id: string) => Promise<void>;
  onStop: (runId: string) => Promise<void>;
  onOpenFolder: (id: string) => Promise<void>;
  onOpenUrl: (id: string) => Promise<void>;
  onOpenConsole: (project: ProjectWithState) => void;
  onEdit: (project: ProjectWithState) => void;
  onRemove: (project: ProjectWithState) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onStart,
  onStop,
  onOpenFolder,
  onOpenUrl,
  onOpenConsole,
  onEdit,
  onRemove
}) => {
  const [copiedPath, setCopiedPath] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const activeRun = project.active_run;
  const isRunning = activeRun?.status === 'running_by_app';

  const handleCopyPath = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(project.canonical_path).then(() => {
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 1800);
    });
  };

  const handleStart = async () => {
    setIsStarting(true);
    try {
      await onStart(project.id);
    } finally {
      setIsStarting(false);
    }
  };

  const hasCommand = Boolean(project.executable && project.executable.trim());
  const formattedCommand = hasCommand 
    ? `${project.executable} ${(project.args || []).join(' ')}`.trim()
    : null;

  return (
    <div className={`project-card glass-panel ${isRunning ? 'card-running' : ''}`}>
      {/* Top Bar: Title, Tags & Status */}
      <div className="card-top-row">
        <div className="card-title-group">
          <div className="card-heading-row">
            <h3 className="card-title">{project.name}</h3>

            {/* Path Health Warning */}
            {!project.path_exists && (
              <span className="badge badge-warning" title="Directory cannot be found on disk">
                <AlertTriangle size={12} />
                MISSING PATH
              </span>
            )}

            {/* Command Disabled Badge */}
            {project.command_disabled && hasCommand && (
              <span className="badge badge-warning" title="Command is disabled for review">
                <ShieldAlert size={12} />
                COMMAND DISABLED
              </span>
            )}
          </div>

          {/* Tags */}
          {project.tags && project.tags.length > 0 && (
            <div className="card-tags-row">
              {project.tags.map((tag, idx) => (
                <span key={idx} className="tag-chip">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Process Status Badge */}
        <div className="card-status-container">
          {isRunning ? (
            <span className="badge badge-running">
              <span className="live-dot status-pulse" />
              RUNNING (PID {activeRun.pid})
            </span>
          ) : activeRun?.status === 'exited' ? (
            <span className={`badge ${activeRun.exit_code === 0 ? 'badge-stopped' : 'badge-failed'}`}>
              EXITED ({activeRun.exit_code ?? 'unknown'})
            </span>
          ) : activeRun?.status === 'failed_to_start' ? (
            <span className="badge badge-failed">
              FAILED
            </span>
          ) : hasCommand ? (
            <span className="badge badge-stopped">
              CONFIGURED
            </span>
          ) : (
            <span className="badge badge-stopped">
              PASSIVE
            </span>
          )}
        </div>
      </div>

      {/* Card Details: Path, Dev URL, Command */}
      <div className="card-details-section">
        {/* Canonical Folder Path */}
        <div className="detail-line">
          <Folder size={14} className="detail-icon text-muted" />
          <span 
            className="detail-path" 
            title={project.canonical_path}
            onClick={() => onOpenFolder(project.id)}
          >
            {truncatePath(project.canonical_path, 42)}
          </span>
          <button 
            className="btn-tiny-icon" 
            onClick={handleCopyPath} 
            title="Copy full directory path"
          >
            {copiedPath ? <Check size={12} className="text-emerald" /> : <Copy size={12} />}
          </button>
        </div>

        {/* Development URL */}
        {project.dev_url && (
          <div className="detail-line">
            <Globe size={14} className="detail-icon text-cyan" />
            <button
              className="detail-url-btn"
              onClick={() => onOpenUrl(project.id)}
              title="Open development URL in default browser"
            >
              <span>{project.dev_url}</span>
              <ExternalLink size={12} className="inline-ext-icon" />
            </button>
          </div>
        )}

        {/* Configured Command */}
        {formattedCommand && (
          <div className="detail-line">
            <Cpu size={14} className="detail-icon text-muted" />
            <code className="command-pill" title={formattedCommand}>
              {formattedCommand}
            </code>
            {project.is_shell_mode && (
              <span className="badge-shell" title="Advanced shell mode active">
                SHELL
              </span>
            )}
          </div>
        )}

        {/* Runtime Timer if Running */}
        {isRunning && activeRun?.started_at && (
          <div className="detail-line runtime-indicator">
            <Clock size={13} className="text-emerald" />
            <span className="text-xs text-emerald font-mono">
              Uptime: {formatElapsedTime(activeRun.started_at)}
            </span>
          </div>
        )}
      </div>

      {/* Actions Toolbar */}
      <div className="card-actions-row">
        <div className="card-primary-actions">
          {/* Start/Stop Button */}
          {isRunning ? (
            <button
              className="btn-action btn-stop"
              onClick={() => activeRun && onStop(activeRun.id)}
              title="Terminate running process"
            >
              <Square size={14} fill="currentColor" />
              <span>Stop</span>
            </button>
          ) : hasCommand ? (
            <button
              className="btn-action btn-start"
              onClick={handleStart}
              disabled={isStarting || !project.path_exists || project.command_disabled}
              title={
                !project.path_exists
                  ? 'Cannot start: folder missing'
                  : project.command_disabled
                  ? 'Cannot start: command disabled for review'
                  : `Launch ${formattedCommand}`
              }
            >
              <Play size={14} fill="currentColor" />
              <span>{isStarting ? 'Starting...' : 'Start'}</span>
            </button>
          ) : null}

          {/* Console / Output Button */}
          <button
            className={`btn-action btn-secondary-action ${isRunning ? 'highlight-console' : ''}`}
            onClick={() => onOpenConsole(project)}
            title="Open real-time output terminal"
          >
            <Terminal size={14} />
            <span>Output</span>
          </button>

          {/* Open Folder Button */}
          <button
            className="btn-action btn-secondary-action"
            onClick={() => onOpenFolder(project.id)}
            title="Open folder in File Explorer"
            disabled={!project.path_exists}
          >
            <FolderOpen size={14} />
            <span>Folder</span>
          </button>
        </div>

        <div className="card-secondary-actions">
          <button
            className="btn-icon-subtle"
            onClick={() => onEdit(project)}
            title="Edit project configuration"
          >
            <Edit3 size={15} />
          </button>

          <button
            className="btn-icon-subtle btn-remove"
            onClick={() => onRemove(project)}
            title="Remove from Localhost (never deletes folder)"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};
