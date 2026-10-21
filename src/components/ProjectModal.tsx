import React, { useState, useEffect } from 'react';
import { ProjectWithState } from '../types';
import { isValidHttpUrl } from '../utils/formatters';
import { 
  FolderOpen, 
  Terminal, 
  Globe, 
  Tag, 
  AlertTriangle, 
  ShieldAlert, 
  Check, 
  X, 
  Info
} from 'lucide-react';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<boolean>;
  editingProject?: ProjectWithState | null;
  existingProjects: ProjectWithState[];
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingProject,
  existingProjects
}) => {
  const [name, setName] = useState('');
  const [canonicalPath, setCanonicalPath] = useState('');
  const [devUrl, setDevUrl] = useState('');
  const [executable, setExecutable] = useState('');
  const [argsString, setArgsString] = useState('');
  const [workingDirectory, setWorkingDirectory] = useState('');
  const [tagsString, setTagsString] = useState('');
  const [isShellMode, setIsShellMode] = useState(false);
  const [commandDisabled, setCommandDisabled] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (editingProject) {
      setName(editingProject.name);
      setCanonicalPath(editingProject.canonical_path);
      setDevUrl(editingProject.dev_url || '');
      setExecutable(editingProject.executable || '');
      setArgsString(Array.isArray(editingProject.args) ? editingProject.args.join(' ') : '');
      setWorkingDirectory(editingProject.working_directory || '');
      setTagsString(Array.isArray(editingProject.tags) ? editingProject.tags.join(', ') : '');
      setIsShellMode(editingProject.is_shell_mode || false);
      setCommandDisabled(editingProject.command_disabled || false);
    } else {
      setName('');
      setCanonicalPath('');
      setDevUrl('');
      setExecutable('');
      setArgsString('');
      setWorkingDirectory('');
      setTagsString('');
      setIsShellMode(false);
      setCommandDisabled(false);
    }
    setError(null);
  }, [editingProject, isOpen]);

  if (!isOpen) return null;

  // Duplicate path check
  const duplicateWarning = existingProjects.find(
    p => p.canonical_path.toLowerCase() === canonicalPath.trim().toLowerCase() && p.id !== editingProject?.id
  );

  const handleBrowseFolder = async () => {
    try {
      const selected = await window.localhostApi.selectFolder();
      if (selected) {
        setCanonicalPath(selected);
        if (!name) {
          // Default name to folder basename
          const base = selected.replace(/[\\/]$/, '').split(/[\\/]/).pop() || '';
          setName(base);
        }
      }
    } catch (err: any) {
      setError(`Failed to select folder: ${err.message}`);
    }
  };

  const parseArgs = (raw: string): string[] => {
    return raw.trim() ? raw.trim().split(/\s+/) : [];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please provide a project name.');
      return;
    }

    if (!canonicalPath.trim()) {
      setError('Please specify or select a project directory.');
      return;
    }

    if (devUrl.trim() && !isValidHttpUrl(devUrl.trim())) {
      setError('Development URL must start with http:// or https://');
      return;
    }

    const payload = {
      name: name.trim(),
      canonical_path: canonicalPath.trim(),
      dev_url: devUrl.trim() || null,
      executable: executable.trim() || null,
      args: parseArgs(argsString),
      working_directory: workingDirectory.trim() || null,
      tags: tagsString.split(',').map(t => t.trim().toLowerCase()).filter(Boolean),
      is_shell_mode: isShellMode,
      command_disabled: commandDisabled
    };

    setIsSaving(true);
    try {
      const success = await onSave(payload);
      if (success) {
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save project.');
    } finally {
      setIsSaving(false);
    }
  };

  const previewArgs = parseArgs(argsString);
  const previewCommand = executable.trim() 
    ? `${executable.trim()} ${previewArgs.join(' ')}`.trim()
    : 'No launch command configured';

  return (
    <div className="modal-backdrop">
      <div className="modal-content glass-panel animate-slide-up">
        <div className="modal-header">
          <div className="modal-title-group">
            <h2 className="modal-title">
              {editingProject ? 'Edit Project Settings' : 'Add Local Project'}
            </h2>
            <p className="modal-subtitle">
              Configure explicit local metadata, launch commands, and shortcuts.
            </p>
          </div>
          <button className="icon-close-btn" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="alert-box alert-error">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {duplicateWarning && (
          <div className="alert-box alert-warning">
            <AlertTriangle size={16} />
            <span>
              Warning: Folder path is already used by registered project "{duplicateWarning.name}".
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label className="form-label" htmlFor="project-name">
              Project Display Name <span className="required">*</span>
            </label>
            <input
              id="project-name"
              type="text"
              className="form-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. My Next.js Web App"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="project-folder">
              Project Folder Path <span className="required">*</span>
            </label>
            <div className="input-with-button">
              <input
                id="project-folder"
                type="text"
                className="form-input font-mono text-sm"
                value={canonicalPath}
                onChange={e => setCanonicalPath(e.target.value)}
                placeholder="C:\Users\...\projects\my-app"
                required
              />
              <button
                type="button"
                className="btn-browse"
                onClick={handleBrowseFolder}
                title="Browse folder natively"
              >
                <FolderOpen size={16} />
                <span>Browse...</span>
              </button>
            </div>
            <span className="form-help">
              Select via native dialog. Localhost never crawls directories without permission.
            </span>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="dev-url">
              Development URL <span className="optional">(optional)</span>
            </label>
            <div className="input-with-icon">
              <Globe size={16} className="input-icon" />
              <input
                id="dev-url"
                type="text"
                className="form-input with-left-icon font-mono text-sm"
                value={devUrl}
                onChange={e => setDevUrl(e.target.value)}
                placeholder="http://localhost:3000"
              />
            </div>
            <span className="form-help">
              One-click shortcut to open your local web service in your default browser.
            </span>
          </div>

          <div className="command-section-card">
            <div className="section-title-row">
              <Terminal size={16} className="text-cyan" />
              <h3 className="section-title">Launch Action Configuration</h3>
            </div>
            <p className="section-desc">
              Localhost runs this command directly using structured arguments, with zero elevation.
            </p>

            <div className="grid-two-cols">
              <div className="form-group">
                <label className="form-label" htmlFor="command-exec">
                  Executable
                </label>
                <input
                  id="command-exec"
                  type="text"
                  className="form-input font-mono text-sm"
                  value={executable}
                  onChange={e => setExecutable(e.target.value)}
                  placeholder="npm, python, cargo, node"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="command-args">
                  Arguments (space separated)
                </label>
                <input
                  id="command-args"
                  type="text"
                  className="form-input font-mono text-sm"
                  value={argsString}
                  onChange={e => setArgsString(e.target.value)}
                  placeholder="run dev, -m http.server 8080"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="command-cwd">
                Custom Working Directory <span className="optional">(defaults to project folder)</span>
              </label>
              <input
                id="command-cwd"
                type="text"
                className="form-input font-mono text-sm"
                value={workingDirectory}
                onChange={e => setWorkingDirectory(e.target.value)}
                placeholder={canonicalPath || 'Relative subpath or leave empty'}
              />
            </div>

            {/* Advanced Shell Mode */}
            <div className="toggle-row">
              <label className="toggle-label" htmlFor="shell-mode">
                <input
                  id="shell-mode"
                  type="checkbox"
                  className="toggle-checkbox"
                  checked={isShellMode}
                  onChange={e => setIsShellMode(e.target.checked)}
                />
                <span className="toggle-text">
                  Enable Advanced Shell Execution Mode
                </span>
              </label>
            </div>
            {isShellMode && (
              <div className="alert-box alert-warning text-xs mt-2">
                <ShieldAlert size={14} />
                <span>
                  Shell mode runs commands via the OS shell (cmd/powershell). Use with caution and ensure arguments are trusted.
                </span>
              </div>
            )}

            {/* Command Disabled switch */}
            <div className="toggle-row mt-2">
              <label className="toggle-label" htmlFor="cmd-disabled">
                <input
                  id="cmd-disabled"
                  type="checkbox"
                  className="toggle-checkbox"
                  checked={commandDisabled}
                  onChange={e => setCommandDisabled(e.target.checked)}
                />
                <span className="toggle-text">
                  Disable Command Execution (Safety Guard)
                </span>
              </label>
            </div>

            {/* Live Launch Preview */}
            <div className="launch-preview-box">
              <div className="preview-label">
                <Info size={13} />
                <span>Exact Launch Preview</span>
              </div>
              <div className="preview-command-text">
                {previewCommand}
              </div>
              <div className="preview-cwd-text">
                Working directory: <code>{workingDirectory || canonicalPath || '(not set)'}</code>
              </div>
              {executable.trim() && (
                <div className="preview-safe-note">
                  <Check size={12} className="text-emerald" />
                  <span>Runs as standard user. Output capped at 5 MB in ring buffer.</span>
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="project-tags">
              Tags <span className="optional">(comma separated)</span>
            </label>
            <div className="input-with-icon">
              <Tag size={16} className="input-icon" />
              <input
                id="project-tags"
                type="text"
                className="form-input with-left-icon"
                value={tagsString}
                onChange={e => setTagsString(e.target.value)}
                placeholder="frontend, react, api, database"
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSaving}
            >
              <Check size={16} />
              <span>{isSaving ? 'Saving...' : editingProject ? 'Save Changes' : 'Register Project'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
