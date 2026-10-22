import React, { useState, useEffect, useRef } from 'react';
import { ProcessRun, OutputChunk, ProjectWithState } from '../types';
import { formatElapsedTime } from '../utils/formatters';
import { AnsiRenderer } from '../utils/ansi';
import { 
  Square, 
  Terminal, 
  Copy, 
  Check, 
  Trash2, 
  Search, 
  ArrowDown, 
  X, 
  Clock,
  Cpu
} from 'lucide-react';

interface ProcessConsoleDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectWithState | null;
  run: ProcessRun | null;
  onStopRun: (runId: string) => Promise<void>;
}

export const ProcessConsoleDrawer: React.FC<ProcessConsoleDrawerProps> = ({
  isOpen,
  onClose,
  project,
  run,
  onStopRun
}) => {
  const [outputChunks, setOutputChunks] = useState<OutputChunk[]>([]);
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const terminalContainerRef = useRef<HTMLDivElement>(null);

  // Load initial output buffer when drawer opens
  useEffect(() => {
    if (!isOpen || !run) {
      setOutputChunks([]);
      return;
    }

    let isMounted = true;
    window.localhostApi.getRunOutput(run.id).then(chunks => {
      if (isMounted) {
        setOutputChunks(chunks);
      }
    });

    // Subscribe to live output
    const unsubscribe = window.localhostApi.onProcessOutput(chunk => {
      if (chunk.runId === run.id && isMounted) {
        setOutputChunks(prev => [...prev, chunk]);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isOpen, run?.id]);

  // Auto-scroll to bottom on new output
  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [outputChunks, autoScroll]);

  if (!isOpen || !run || !project) return null;

  const isRunning = run.status === 'running_by_app';

  const handleCopyLogs = () => {
    const fullText = outputChunks.map(c => c.text).join('');
    navigator.clipboard.writeText(fullText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleClearOutput = () => {
    setOutputChunks([]);
  };

  const filteredChunks = searchQuery.trim()
    ? outputChunks.filter(c => c.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : outputChunks;

  return (
    <div className="drawer-backdrop">
      <div className="drawer-container glass-panel animate-slide-up">
        {/* Drawer Header */}
        <div className="drawer-header">
          <div className="drawer-title-group">
            <div className="drawer-title-row">
              <Terminal size={18} className="text-cyan" />
              <h2 className="drawer-project-name">{project.name}</h2>
              {isRunning ? (
                <span className="badge badge-running">
                  <span className="live-dot status-pulse" />
                  RUNNING (PID: {run.pid})
                </span>
              ) : run.status === 'exited' ? (
                <span className={`badge ${run.exit_code === 0 ? 'badge-stopped' : 'badge-failed'}`}>
                  EXITED (CODE: {run.exit_code ?? 'unknown'})
                </span>
              ) : (
                <span className="badge badge-failed">
                  FAILED TO START
                </span>
              )}
            </div>

            <div className="drawer-meta-row">
              <span className="meta-item">
                <Cpu size={12} />
                <code>{run.command_preview}</code>
              </span>
              <span className="meta-item">
                <Clock size={12} />
                Started {formatElapsedTime(run.started_at, run.ended_at)} ago
              </span>
            </div>
          </div>

          <div className="drawer-actions">
            {isRunning && (
              <button
                className="btn-stop-danger"
                onClick={() => onStopRun(run.id)}
                title="Terminate child process"
              >
                <Square size={14} fill="currentColor" />
                <span>Stop Process</span>
              </button>
            )}

            <button
              className="btn-icon"
              onClick={handleCopyLogs}
              title="Copy output to clipboard"
            >
              {copied ? <Check size={16} className="text-emerald" /> : <Copy size={16} />}
            </button>

            <button
              className="btn-icon"
              onClick={handleClearOutput}
              title="Clear visible logs"
            >
              <Trash2 size={16} />
            </button>

            <button
              className={`btn-icon ${autoScroll ? 'active-icon' : ''}`}
              onClick={() => setAutoScroll(!autoScroll)}
              title={autoScroll ? 'Auto-scroll enabled' : 'Auto-scroll paused'}
            >
              <ArrowDown size={16} />
            </button>

            <button className="icon-close-btn" onClick={onClose} aria-label="Close logs">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="drawer-search-bar">
          <div className="search-input-wrapper">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              className="search-input-sm"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search in log output..."
            />
          </div>
          <span className="log-stats-text">
            {outputChunks.length} chunks logged • Bounded 5 MB memory cap
          </span>
        </div>

        {/* Terminal Output Area */}
        <div className="terminal-viewport" ref={terminalContainerRef}>
          {filteredChunks.length === 0 ? (
            <div className="terminal-empty">
              <Terminal size={32} className="text-muted mb-2" />
              <p>No output recorded yet.</p>
              <span className="text-xs text-muted">
                Process output will stream live here once started.
              </span>
            </div>
          ) : (
            <div className="terminal-content">
              {filteredChunks.map((chunk, index) => {
                const streamClass = 
                  chunk.stream === 'stderr' ? 'stream-stderr' :
                  chunk.stream === 'system' ? 'stream-system' : 'stream-stdout';
                return (
                  <span key={index} className={`terminal-line ${streamClass}`}>
                    <AnsiRenderer text={chunk.text} />
                  </span>
                );
              })}
              <div ref={terminalEndRef} />
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="drawer-footer">
          <span className="footer-status-info">
            Working directory: <code>{run.working_directory}</code>
          </span>
          <span className="footer-security-note">
            App-managed child process • Non-elevated execution
          </span>
        </div>
      </div>
    </div>
  );
};
