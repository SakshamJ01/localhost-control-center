import React, { useState, useEffect } from 'react';
import { ProjectWithState, ProjectDetection, DetectedScript, AIAnalysisResult } from '../types';
import { analyzeProjectWithAI } from '../services/aiService';
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
  Info,
  Sparkles,
  SlidersHorizontal,
  RefreshCw,
  Bot
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
  const [customCommandLine, setCustomCommandLine] = useState('');
  const [workingDirectory, setWorkingDirectory] = useState('');
  const [tagsString, setTagsString] = useState('');
  const [isShellMode, setIsShellMode] = useState(false);
  const [commandDisabled, setCommandDisabled] = useState(false);

  // Auto-detection state
  const [detection, setDetection] = useState<ProjectDetection | null>(null);
  const [detectedScripts, setDetectedScripts] = useState<DetectedScript[]>([]);
  const [selectedScriptId, setSelectedScriptId] = useState<string>('custom');
  const [isDetecting, setIsDetecting] = useState(false);

  // AI Analysis state
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Reset or initialize state
  useEffect(() => {
    if (editingProject) {
      setName(editingProject.name);
      setCanonicalPath(editingProject.canonical_path);
      setDevUrl(editingProject.dev_url || '');
      setExecutable(editingProject.executable || '');
      const currentArgs = Array.isArray(editingProject.args) ? editingProject.args.join(' ') : '';
      setArgsString(currentArgs);
      setCustomCommandLine(editingProject.executable ? `${editingProject.executable} ${currentArgs}`.trim() : '');
      setWorkingDirectory(editingProject.working_directory || '');
      setTagsString(Array.isArray(editingProject.tags) ? editingProject.tags.join(', ') : '');
      setIsShellMode(editingProject.is_shell_mode || false);
      setCommandDisabled(editingProject.command_disabled || false);
      setSelectedScriptId('custom');
      setAiAnalysis(null);

      // Try detecting project in background to populate available scripts
      if (editingProject.canonical_path) {
        runDetection(editingProject.canonical_path, true);
      }
    } else {
      setName('');
      setCanonicalPath('');
      setDevUrl('');
      setExecutable('');
      setArgsString('');
      setCustomCommandLine('');
      setWorkingDirectory('');
      setTagsString('');
      setIsShellMode(false);
      setCommandDisabled(false);
      setDetection(null);
      setDetectedScripts([]);
      setSelectedScriptId('custom');
      setAiAnalysis(null);
    }
    setError(null);
  }, [editingProject, isOpen]);

  if (!isOpen) return null;

  // Duplicate path check
  const duplicateWarning = existingProjects.find(
    p => p.canonical_path.toLowerCase() === canonicalPath.trim().toLowerCase() && p.id !== editingProject?.id
  );

  // Token parser for unified command line
  const parseCommandLine = (raw: string): { exec: string; args: string[] } => {
    let cleaned = raw.trim();
    if (!cleaned) return { exec: '', args: [] };

    // If user entered comma-separated commands, pick the primary one
    if (cleaned.includes(',')) {
      cleaned = cleaned.split(',')[0].trim();
    }

    const tokens: string[] = [];
    let current = '';
    let inQuote = false;
    let quoteChar = '';

    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i];
      if ((char === '"' || char === "'") && (!inQuote || char === quoteChar)) {
        inQuote = !inQuote;
        quoteChar = inQuote ? char : '';
      } else if (char === ' ' && !inQuote) {
        if (current.length > 0) {
          tokens.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }
    if (current.length > 0) {
      tokens.push(current);
    }

    if (tokens.length === 0) return { exec: '', args: [] };

    const exec = tokens[0];
    let args = tokens.slice(1);

    // Auto-fix repeated binary names (e.g., user wrote "npm npm run dev")
    if (args.length > 0 && args[0].toLowerCase() === exec.toLowerCase()) {
      args = args.slice(1);
    }

    return { exec, args };
  };

  // Run auto-detection on a folder path
  const runDetection = async (folderPath: string, isPreservingForm = false) => {
    if (!folderPath || !window.localhostApi?.detectProject) return;
    setIsDetecting(true);
    try {
      const result = await window.localhostApi.detectProject(folderPath);
      if (result) {
        setDetection(result);
        setDetectedScripts(result.available_scripts);

        if (!isPreservingForm) {
          // Pre-fill Name if not customized
          if (!name.trim()) {
            setName(result.suggested_name);
          }
          // Pre-fill Dev URL if available and empty
          if (result.suggested_dev_url && !devUrl.trim()) {
            setDevUrl(result.suggested_dev_url);
          }
          // Pre-fill Tags if empty
          if (!tagsString.trim() && result.suggested_tags.length > 0) {
            setTagsString(result.suggested_tags.join(', '));
          }

          // Pre-select recommended script
          if (result.recommended_script) {
            setSelectedScriptId(result.recommended_script.id);
            setExecutable(result.recommended_script.executable);
            setArgsString(result.recommended_script.args.join(' '));
            setCustomCommandLine(result.recommended_script.full_command);
            setCommandDisabled(false);
          } else if (result.available_scripts.length > 0) {
            const first = result.available_scripts[0];
            setSelectedScriptId(first.id);
            setExecutable(first.executable);
            setArgsString(first.args.join(' '));
            setCustomCommandLine(first.full_command);
            setCommandDisabled(false);
          } else {
            setSelectedScriptId('custom');
          }
        } else {
          // Check if current executable + args matches one of the detected scripts
          const currentExec = executable.trim().toLowerCase();
          const currentArgs = argsString.trim().toLowerCase();
          const match = result.available_scripts.find(s => 
            s.executable.toLowerCase() === currentExec && s.args.join(' ').toLowerCase() === currentArgs
          );
          if (match) {
            setSelectedScriptId(match.id);
          } else {
            setSelectedScriptId('custom');
          }
        }
      }
    } catch (err: any) {
      console.warn('Auto-detection error:', err);
    } finally {
      setIsDetecting(false);
    }
  };

  // Run deep AI codebase and architecture analysis
  const handleRunAIAnalysis = async (targetPath?: string) => {
    const pathToAnalyze = (targetPath || canonicalPath).trim().replace(/^["']|["']$/g, '');
    if (!pathToAnalyze) {
      setError('Please specify a project folder first.');
      return;
    }
    setIsAnalyzingAI(true);
    setError(null);
    try {
      const context = await window.localhostApi.readProjectContext(pathToAnalyze);
      if (!context) {
        setError('Could not access folder files for AI analysis.');
        return;
      }
      const settings = await window.localhostApi.getSettings();
      const result = await analyzeProjectWithAI(context, settings);
      setAiAnalysis(result);

      // Auto-apply AI recommendations!
      if (!name || name === pathToAnalyze.replace(/[\\/]$/, '').split(/[\\/]/).pop()) {
        setName(result.project_name);
      }
      if (result.dev_url && !devUrl) {
        setDevUrl(result.dev_url);
      }
      if (result.tags.length > 0 && !tagsString) {
        setTagsString(result.tags.join(', '));
      }

      setExecutable(result.executable);
      setArgsString(result.args.join(' '));
      setCustomCommandLine(result.recommended_command);
      setCommandDisabled(false);

      // Check if recommended command matches any detected script
      const match = detectedScripts.find(s => s.full_command.toLowerCase() === result.recommended_command.toLowerCase());
      if (match) {
        setSelectedScriptId(match.id);
      } else {
        setSelectedScriptId('custom');
      }
    } catch (err: any) {
      console.warn('AI analysis error:', err);
      setError(`AI analysis error: ${err.message || err}`);
    } finally {
      setIsAnalyzingAI(false);
    }
  };

  const handleBrowseFolder = async () => {
    try {
      const selected = await window.localhostApi.selectFolder();
      if (selected) {
        const clean = selected.trim().replace(/^["']|["']$/g, '');
        setCanonicalPath(clean);
        // Automatically run detection on folder pick
        await runDetection(clean, false);
        // And automatically trigger AI analysis for deep understanding
        await handleRunAIAnalysis(clean);
      }
    } catch (err: any) {
      setError(`Failed to select folder: ${err.message}`);
    }
  };

  const handleManualPathBlur = async () => {
    const clean = canonicalPath.trim().replace(/^["']|["']$/g, '');
    if (clean !== canonicalPath) {
      setCanonicalPath(clean);
    }
    if (clean) {
      await runDetection(clean, Boolean(editingProject));
      if (!editingProject) {
        await handleRunAIAnalysis(clean);
      }
    }
  };

  const handlePathPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').trim().replace(/^["']|["']$/g, '');
    if (pasted) {
      e.preventDefault();
      setCanonicalPath(pasted);
      runDetection(pasted, Boolean(editingProject));
      if (!editingProject) {
        handleRunAIAnalysis(pasted);
      }
    }
  };

  // Handle script selection from dropdown
  const handleScriptSelectChange = (scriptId: string) => {
    setSelectedScriptId(scriptId);

    if (scriptId === 'none') {
      setExecutable('');
      setArgsString('');
      setCustomCommandLine('');
      setCommandDisabled(true);
      return;
    }

    if (scriptId === 'custom') {
      setCommandDisabled(false);
      return;
    }

    const script = detectedScripts.find(s => s.id === scriptId);
    if (script) {
      setExecutable(script.executable);
      setArgsString(script.args.join(' '));
      setCustomCommandLine(script.full_command);
      setCommandDisabled(false);
    }
  };

  // Handle custom command text input
  const handleCustomCommandChange = (value: string) => {
    setCustomCommandLine(value);
    const { exec, args } = parseCommandLine(value);
    setExecutable(exec);
    setArgsString(args.join(' '));
  };

  // Handle preset chip click
  const handlePresetClick = (exec: string, args: string, full: string) => {
    setSelectedScriptId('custom');
    setExecutable(exec);
    setArgsString(args);
    setCustomCommandLine(full);
    setCommandDisabled(false);
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

    // Determine final executable & arguments
    let finalExec = executable.trim();
    let finalArgs: string[] = [];

    if (commandDisabled || selectedScriptId === 'none') {
      finalExec = '';
      finalArgs = [];
    } else if (finalExec) {
      const parsed = parseCommandLine(customCommandLine || `${finalExec} ${argsString}`);
      finalExec = parsed.exec;
      finalArgs = parsed.args;
    }

    const payload = {
      name: name.trim(),
      canonical_path: canonicalPath.trim(),
      dev_url: devUrl.trim() || null,
      executable: finalExec || null,
      args: finalArgs,
      working_directory: workingDirectory.trim() || null,
      tags: tagsString.split(',').map(t => t.trim().toLowerCase()).filter(Boolean),
      is_shell_mode: isShellMode,
      command_disabled: commandDisabled || selectedScriptId === 'none'
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

  // Calculated launch preview
  const isCommandActive = !commandDisabled && selectedScriptId !== 'none' && executable.trim().length > 0;
  const previewExec = executable.trim();
  const previewArgs = argsString.trim();
  const previewCommand = isCommandActive 
    ? `${previewExec} ${previewArgs}`.trim()
    : 'No launch command configured (folder only)';

  return (
    <div className="modal-backdrop">
      <div className="modal-content glass-panel animate-slide-up">
        <div className="modal-header">
          <div className="modal-title-group">
            <h2 className="modal-title">
              {editingProject ? 'Edit Project Settings' : 'Add Local Project'}
            </h2>
            <p className="modal-subtitle">
              Choose a project folder — Localhost automatically configures scripts, framework, and shortcuts.
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

        {/* Auto-detected framework banner */}
        {detection && (
          <div className="auto-detected-banner animate-fade-in">
            <Sparkles size={18} className="text-emerald" />
            <div className="detection-text-group">
              <div className="detection-title">
                <span>Auto-detected:</span>
                <strong>{detection.framework}</strong>
                {detection.package_manager !== 'none' && (
                  <span className="detection-tag-pill">{detection.package_manager}</span>
                )}
              </div>
              <p className="detection-desc">
                {detection.recommended_script 
                  ? `Configured to run "${detection.recommended_script.full_command}"` 
                  : 'Folder structure verified.'}
                {detection.suggested_dev_url && ` • Preview shortcut: ${detection.suggested_dev_url}`}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Project Folder Path (Primary 1st Step) */}
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
                onBlur={handleManualPathBlur}
                onPaste={handlePathPaste}
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
              {canonicalPath.trim() && (
                <>
                  <button
                    type="button"
                    className="btn-ai-analyze"
                    onClick={() => handleRunAIAnalysis()}
                    disabled={isAnalyzingAI}
                    title="Deep AI Codebase & Launch Analysis"
                  >
                    <Sparkles size={14} className={isAnalyzingAI ? 'animate-spin' : ''} />
                    <span>{isAnalyzingAI ? 'Analyzing...' : 'AI Analyze'}</span>
                  </button>
                  <button
                    type="button"
                    className="btn-secondary-action"
                    onClick={() => runDetection(canonicalPath.trim(), false)}
                    title="Re-run Quick Detection"
                    disabled={isDetecting}
                  >
                    <RefreshCw size={14} className={isDetecting ? 'animate-spin' : ''} />
                  </button>
                </>
              )}
            </div>
            {isAnalyzingAI && (
              <div className="alert-box alert-info animate-pulse mt-2 text-xs">
                <Sparkles size={14} className="animate-spin text-cyan flex-shrink-0" />
                <span>AI Assistant is reading project package.json and README to configure commands and preview URL...</span>
              </div>
            )}
            <span className="form-help">
              Pick your folder. Localhost safely checks top-level files or uses AI to configure scripts.
            </span>
          </div>

          {/* AI Project Intelligence Card */}
          {aiAnalysis && (
            <div className="ai-analysis-card animate-fade-in">
              <div className="ai-card-header">
                <div className="ai-card-title-row">
                  <Bot size={18} className="text-cyan animate-pulse" />
                  <span className="ai-badge">AI ARCHITECT</span>
                  <strong className="ai-project-title">{aiAnalysis.framework}</strong>
                </div>
                <span className="ai-tag">⚡ {aiAnalysis.recommended_command}</span>
              </div>

              <p className="ai-summary-text">{aiAnalysis.summary}</p>

              <div className="ai-explanation-box">
                <Info size={14} className="text-cyan flex-shrink-0" />
                <span>{aiAnalysis.command_explanation}</span>
              </div>

              {aiAnalysis.prerequisites && aiAnalysis.prerequisites.length > 0 && (
                <div className="ai-prereqs-list">
                  <span className="prereq-title">Setup Diagnostics:</span>
                  <ul>
                    {aiAnalysis.prerequisites.map((p, idx) => (
                      <li key={idx}>
                        <Check size={12} className="text-emerald flex-shrink-0" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {aiAnalysis.warnings && aiAnalysis.warnings.length > 0 && (
                <div className="ai-warnings-list">
                  {aiAnalysis.warnings.map((w, idx) => (
                    <div key={idx} className="ai-warning-item">
                      <AlertTriangle size={13} className="text-amber flex-shrink-0" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Project Display Name */}
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
              placeholder="e.g. Clearstep, Portfolio, Backend API"
              required
            />
          </div>

          {/* Launch Action Configuration */}
          <div className="command-section-card">
            <div className="section-title-row">
              <Terminal size={16} className="text-cyan" />
              <h3 className="section-title">Launch Action Configuration</h3>
            </div>
            <p className="section-desc">
              Select the command to run when you click Play. Localhost supervises this process locally.
            </p>

            {/* Script Selector Dropdown (When scripts are detected) */}
            {detectedScripts.length > 0 && (
              <div className="form-group">
                <label className="form-label" htmlFor="script-selector">
                  Detected Service Scripts <span className="text-emerald text-xs font-normal">• 1-Click Setup</span>
                </label>
                <select
                  id="script-selector"
                  className="form-select font-mono"
                  value={selectedScriptId}
                  onChange={e => handleScriptSelectChange(e.target.value)}
                >
                  {detectedScripts.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.is_recommended ? `⚡ ${s.full_command}  (Recommended — ${s.name})` : `▶ ${s.full_command}  (${s.name})`}
                    </option>
                  ))}
                  <option value="custom">✏️ Custom Command...</option>
                  <option value="none">📁 Folder Only (Do not run a command)</option>
                </select>
              </div>
            )}

            {/* Unified Command Line Input (When custom is selected or no scripts detected) */}
            {(selectedScriptId === 'custom' || detectedScripts.length === 0) && (
              <div className="form-group">
                <label className="form-label" htmlFor="custom-command-line">
                  Command Line
                </label>
                <input
                  id="custom-command-line"
                  type="text"
                  className="form-input font-mono text-sm"
                  value={customCommandLine}
                  onChange={e => handleCustomCommandChange(e.target.value)}
                  placeholder="e.g. npm run dev, python app.py, cargo run"
                />
                <span className="form-help">
                  Type your command naturally. Localhost handles executable and argument separation automatically.
                </span>
              </div>
            )}

            {/* Quick Presets */}
            <div className="preset-chips-container">
              <span className="preset-label">Quick Presets:</span>
              <div className="preset-buttons">
                <button
                  type="button"
                  className="btn-preset-chip"
                  onClick={() => handlePresetClick('npm', 'run dev', 'npm run dev')}
                >
                  ⚡ npm run dev
                </button>
                <button
                  type="button"
                  className="btn-preset-chip"
                  onClick={() => handlePresetClick('npm', 'start', 'npm start')}
                >
                  ▶ npm start
                </button>
                <button
                  type="button"
                  className="btn-preset-chip"
                  onClick={() => handlePresetClick('python', 'app.py', 'python app.py')}
                >
                  🐍 python app.py
                </button>
                <button
                  type="button"
                  className="btn-preset-chip"
                  onClick={() => handlePresetClick('cargo', 'run', 'cargo run')}
                >
                  🦀 cargo run
                </button>
                <button
                  type="button"
                  className="btn-preset-chip text-muted"
                  onClick={() => handleScriptSelectChange('none')}
                >
                  📁 Folder Only
                </button>
              </div>
            </div>

            {/* Advanced Execution Settings Accordion */}
            <details className="advanced-settings-accordion">
              <summary className="advanced-settings-summary">
                <SlidersHorizontal size={14} />
                <span>Advanced Settings (CWD, Shell Mode, Raw Flags)</span>
              </summary>
              <div className="advanced-settings-body">
                <div className="grid-two-cols">
                  <div className="form-group">
                    <label className="form-label" htmlFor="command-exec">
                      Raw Executable
                    </label>
                    <input
                      id="command-exec"
                      type="text"
                      className="form-input font-mono text-sm"
                      value={executable}
                      onChange={e => {
                        setExecutable(e.target.value);
                        setCustomCommandLine(`${e.target.value} ${argsString}`.trim());
                      }}
                      placeholder="e.g. npm, python, cargo"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="command-args">
                      Raw Arguments
                    </label>
                    <input
                      id="command-args"
                      type="text"
                      className="form-input font-mono text-sm"
                      value={argsString}
                      onChange={e => {
                        setArgsString(e.target.value);
                        setCustomCommandLine(`${executable} ${e.target.value}`.trim());
                      }}
                      placeholder="e.g. run dev"
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
                  <div className="alert-box alert-warning text-xs">
                    <ShieldAlert size={14} />
                    <span>
                      Shell mode executes commands via OS shell. Use only with trusted commands.
                    </span>
                  </div>
                )}

                <div className="toggle-row">
                  <label className="toggle-label" htmlFor="cmd-disabled">
                    <input
                      id="cmd-disabled"
                      type="checkbox"
                      className="toggle-checkbox"
                      checked={commandDisabled}
                      onChange={e => setCommandDisabled(e.target.checked)}
                    />
                    <span className="toggle-text">
                      Disable Process Launching (Folder Tracking Only)
                    </span>
                  </label>
                </div>
              </div>
            </details>

            {/* Launch Preview Box */}
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
              {isCommandActive && (
                <div className="preview-safe-note">
                  <Check size={12} className="text-emerald" />
                  <span>Runs as standard user process • Clean child tree termination</span>
                </div>
              )}
            </div>
          </div>

          {/* Development URL */}
          <div className="form-group">
            <label className="form-label" htmlFor="dev-url">
              Development URL <span className="optional">(optional shortcut)</span>
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
              One-click shortcut to launch your service in your default web browser.
            </span>
          </div>

          {/* Tags */}
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
                placeholder="frontend, react, nextjs, api"
              />
            </div>
          </div>

          {/* Footer Actions */}
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
