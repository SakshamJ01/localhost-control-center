import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ProjectWithState, ProcessRun } from './types';
import { ProjectCard } from './components/ProjectCard';
import { ProjectModal } from './components/ProjectModal';
import { ProcessConsoleDrawer } from './components/ProcessConsoleDrawer';
import { SettingsModal } from './components/SettingsModal';
import { OnboardingModal } from './components/OnboardingModal';
import { RemoveConfirmModal } from './components/RemoveConfirmModal';
import { 
  Plus, 
  Search, 
  Settings, 
  HelpCircle, 
  Terminal, 
  FolderPlus, 
  CheckCircle, 
  AlertTriangle, 
  ShieldCheck, 
  Activity, 
  X
} from 'lucide-react';

export const App: React.FC = () => {
  const [projects, setProjects] = useState<ProjectWithState[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'configured' | 'missing'>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Modals state
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectWithState | null>(null);

  const [consoleDrawerOpen, setConsoleDrawerOpen] = useState(false);
  const [consoleProject, setConsoleProject] = useState<ProjectWithState | null>(null);
  const [consoleRun, setConsoleRun] = useState<ProcessRun | null>(null);

  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [onboardingModalOpen, setOnboardingModalOpen] = useState(false);

  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [projectToRemove, setProjectToRemove] = useState<ProjectWithState | null>(null);

  const [toastMessage, setToastMessage] = useState<{ type: 'info' | 'error' | 'success'; text: string } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const showToast = (text: string, type: 'info' | 'error' | 'success' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(prev => (prev?.text === text ? null : prev));
    }, 3500);
  };

  // Load projects from IPC
  const fetchProjects = async () => {
    try {
      if (window.localhostApi) {
        const list = await window.localhostApi.listProjects();
        setProjects(list);
      }
    } catch (err: any) {
      console.error('Failed to load projects:', err);
      showToast(`Error loading projects: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();

    // Subscribe to process status changes
    let unsubscribeStatus: (() => void) | undefined;
    if (window.localhostApi) {
      unsubscribeStatus = window.localhostApi.onProcessStatusChange((updatedRun) => {
        setProjects(prev => prev.map(p => {
          if (p.id === updatedRun.project_id) {
            return {
              ...p,
              active_run: updatedRun.status === 'running_by_app' ? updatedRun : null
            };
          }
          return p;
        }));

        // If console is viewing this run, keep run updated
        if (consoleRun?.id === updatedRun.id) {
          setConsoleRun(updatedRun);
        }
      });
    }

    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setEditingProject(null);
        setProjectModalOpen(true);
      } else if (e.key === '/' && document.activeElement !== searchInputRef.current && !projectModalOpen && !settingsModalOpen && !onboardingModalOpen) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        setProjectModalOpen(false);
        setSettingsModalOpen(false);
        setOnboardingModalOpen(false);
        setRemoveModalOpen(false);
        setConsoleDrawerOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (unsubscribeStatus) unsubscribeStatus();
    };
  }, [consoleRun?.id, projectModalOpen, settingsModalOpen, onboardingModalOpen]);

  // Project Actions
  const handleSaveProject = async (data: any): Promise<boolean> => {
    try {
      if (editingProject) {
        const res = await window.localhostApi.updateProject(editingProject.id, data);
        if (!res.success) {
          showToast(res.error || 'Failed to update project', 'error');
          return false;
        }
        showToast(`Updated "${res.project?.name}"`, 'success');
      } else {
        const res = await window.localhostApi.addProject(data);
        if (!res.success) {
          showToast(res.error || 'Failed to add project', 'error');
          return false;
        }
        showToast(`Registered "${res.project?.name}"`, 'success');
      }
      await fetchProjects();
      return true;
    } catch (err: any) {
      showToast(err.message, 'error');
      return false;
    }
  };

  const handleStartProject = async (id: string) => {
    try {
      const res = await window.localhostApi.startProject(id);
      if (!res.success) {
        showToast(res.error || 'Failed to start project', 'error');
        return;
      }
      showToast('Process launched successfully', 'success');
      await fetchProjects();

      // Automatically offer to open console
      const proj = projects.find(p => p.id === id);
      if (proj && res.runId) {
        const runs = await window.localhostApi.getRuns();
        const run = runs.find(r => r.id === res.runId);
        if (run) {
          setConsoleProject(proj);
          setConsoleRun(run);
          setConsoleDrawerOpen(true);
        }
      }
    } catch (err: any) {
      showToast(`Launch failed: ${err.message}`, 'error');
    }
  };

  const handleStopRun = async (runId: string) => {
    try {
      const res = await window.localhostApi.stopRun(runId);
      if (!res.success) {
        showToast(res.error || 'Failed to stop process', 'error');
        return;
      }
      showToast('Process stopped cleanly', 'info');
      await fetchProjects();
    } catch (err: any) {
      showToast(`Stop failed: ${err.message}`, 'error');
    }
  };

  const handleOpenFolder = async (id: string) => {
    try {
      const res = await window.localhostApi.openFolder(id);
      if (!res.success) {
        showToast(res.error || 'Failed to open directory', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleOpenUrl = async (id: string) => {
    try {
      const res = await window.localhostApi.openUrl(id);
      if (!res.success) {
        showToast(res.error || 'Failed to open URL', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleOpenConsole = async (project: ProjectWithState) => {
    setConsoleProject(project);
    if (project.active_run) {
      setConsoleRun(project.active_run);
    } else {
      // Find latest completed run for this project
      const runs = await window.localhostApi.getRuns();
      const latest = runs.find(r => r.project_id === project.id);
      if (latest) {
        setConsoleRun(latest);
      } else {
        // Mock a placeholder run for empty console
        setConsoleRun({
          id: `placeholder_${project.id}`,
          project_id: project.id,
          pid: null,
          started_at: new Date().toISOString(),
          ended_at: null,
          status: 'unknown',
          exit_code: null,
          command_preview: project.executable ? `${project.executable} ${(project.args || []).join(' ')}` : 'No command',
          working_directory: project.canonical_path
        });
      }
    }
    setConsoleDrawerOpen(true);
  };

  const handleConfirmRemove = async (id: string) => {
    try {
      const res = await window.localhostApi.removeProject(id);
      if (!res.success) {
        showToast(res.error || 'Failed to remove project', 'error');
        return;
      }
      showToast('Project removed from Localhost (source files untouched)', 'info');
      await fetchProjects();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Extract all unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    projects.forEach(p => {
      (p.tags || []).forEach(t => set.add(t));
    });
    return Array.from(set).sort();
  }, [projects]);

  // Filter projects
  const filteredProjects = useMemo(() => {
    return projects.filter(proj => {
      // 1. Text search
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchName = proj.name.toLowerCase().includes(q);
        const matchPath = proj.canonical_path.toLowerCase().includes(q);
        const matchExec = proj.executable?.toLowerCase().includes(q);
        const matchTags = (proj.tags || []).some(t => t.toLowerCase().includes(q));
        if (!matchName && !matchPath && !matchExec && !matchTags) return false;
      }

      // 2. Status filter
      if (statusFilter === 'running') {
        if (proj.active_run?.status !== 'running_by_app') return false;
      } else if (statusFilter === 'configured') {
        if (!proj.executable || !proj.executable.trim()) return false;
      } else if (statusFilter === 'missing') {
        if (proj.path_exists) return false;
      }

      // 3. Tag filter
      if (selectedTag) {
        if (!(proj.tags || []).includes(selectedTag)) return false;
      }

      return true;
    });
  }, [projects, searchQuery, statusFilter, selectedTag]);

  const runningCount = projects.filter(p => p.active_run?.status === 'running_by_app').length;
  const missingPathCount = projects.filter(p => !p.path_exists).length;

  return (
    <div className="app-shell">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`toast-notification toast-${toastMessage.type} animate-slide-up`}>
          <span>{toastMessage.text}</span>
          <button className="toast-close" onClick={() => setToastMessage(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Top Application Bar */}
      <header className="app-header glass-panel">
        <div className="header-left">
          <div className="brand-logo-container">
            <div className="brand-icon-wrapper">
              <Activity size={20} className="brand-icon text-cyan" />
            </div>
            <div>
              <div className="brand-title-row">
                <h1 className="brand-title">Localhost</h1>
                <span className="brand-badge">CONTROL CENTER</span>
              </div>
              <p className="brand-tagline">Calm, local-first dashboard for your active projects</p>
            </div>
          </div>
        </div>

        <div className="header-right">
          {runningCount > 0 && (
            <div className="running-indicator-chip" title={`${runningCount} processes running`}>
              <span className="live-dot status-pulse" />
              <span>{runningCount} Active {runningCount === 1 ? 'Service' : 'Services'}</span>
            </div>
          )}

          <button
            className="btn-header-action"
            onClick={() => setOnboardingModalOpen(true)}
            title="Privacy & Principles"
          >
            <HelpCircle size={17} />
            <span>Principles</span>
          </button>

          <button
            className="btn-header-action"
            onClick={() => setSettingsModalOpen(true)}
            title="Settings & Audit Trail"
          >
            <Settings size={17} />
            <span>Settings</span>
          </button>

          <button
            className="btn-primary btn-add-project"
            onClick={() => {
              setEditingProject(null);
              setProjectModalOpen(true);
            }}
          >
            <Plus size={16} />
            <span>Add Project</span>
            <kbd className="kbd-shortcut">Ctrl+N</kbd>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="main-viewport">
        {/* Controls Bar: Search, Stats, Filters */}
        <section className="controls-bar glass-panel">
          <div className="search-box-wrapper">
            <Search size={16} className="search-box-icon text-muted" />
            <input
              ref={searchInputRef}
              type="text"
              className="search-box-input"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search projects by name, path, executable, or tag... (Press '/' to focus)"
            />
            {searchQuery && (
              <button className="search-clear-btn" onClick={() => setSearchQuery('')}>
                <X size={14} />
              </button>
            )}
          </div>

          <div className="filter-pills-row">
            <button
              className={`filter-pill ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              All Projects ({projects.length})
            </button>

            <button
              className={`filter-pill ${statusFilter === 'running' ? 'active' : ''}`}
              onClick={() => setStatusFilter('running')}
            >
              <span className="pill-dot emerald" />
              Running ({runningCount})
            </button>

            <button
              className={`filter-pill ${statusFilter === 'configured' ? 'active' : ''}`}
              onClick={() => setStatusFilter('configured')}
            >
              With Commands
            </button>

            {missingPathCount > 0 && (
              <button
                className={`filter-pill ${statusFilter === 'missing' ? 'active pill-warning' : ''}`}
                onClick={() => setStatusFilter('missing')}
              >
                <AlertTriangle size={12} className="text-amber" />
                Missing Path ({missingPathCount})
              </button>
            )}
          </div>
        </section>

        {/* Tag Filters Row (if any) */}
        {allTags.length > 0 && (
          <div className="tags-filter-bar">
            <span className="tags-label">Tags:</span>
            {selectedTag && (
              <button className="tag-filter-chip active-tag" onClick={() => setSelectedTag(null)}>
                <span>#{selectedTag}</span>
                <X size={12} />
              </button>
            )}
            {allTags
              .filter(t => t !== selectedTag)
              .map(tag => (
                <button
                  key={tag}
                  className="tag-filter-chip"
                  onClick={() => setSelectedTag(tag)}
                >
                  #{tag}
                </button>
              ))}
          </div>
        )}

        {/* Content Section: Projects Grid or Empty State */}
        {loading ? (
          <div className="empty-state-card glass-panel">
            <div className="spinner mb-3" />
            <p className="text-secondary">Loading local project registry...</p>
          </div>
        ) : filteredProjects.length > 0 ? (
          <div className="projects-grid">
            {filteredProjects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                onStart={handleStartProject}
                onStop={handleStopRun}
                onOpenFolder={handleOpenFolder}
                onOpenUrl={handleOpenUrl}
                onOpenConsole={handleOpenConsole}
                onEdit={proj => {
                  setEditingProject(proj);
                  setProjectModalOpen(true);
                }}
                onRemove={proj => {
                  setProjectToRemove(proj);
                  setRemoveModalOpen(true);
                }}
              />
            ))}
          </div>
        ) : projects.length === 0 ? (
          /* Empty state on fresh install */
          <div className="welcome-empty-state glass-panel animate-fade-in">
            <div className="welcome-icon-box">
              <FolderPlus size={36} className="text-cyan" />
            </div>
            <h2 className="welcome-title">One Calm Home for Your Local Projects</h2>
            <p className="welcome-desc">
              Organize your local development repositories, web servers, and databases. See process status, open folders, access localhost URLs, and run safe commands without losing context.
            </p>

            <div className="welcome-features-list">
              <div className="welcome-feature-item">
                <ShieldCheck size={16} className="text-emerald" />
                <span>100% local — zero cloud account or external tracking</span>
              </div>
              <div className="welcome-feature-item">
                <CheckCircle size={16} className="text-cyan" />
                <span>Your source files and git history remain untouched</span>
              </div>
              <div className="welcome-feature-item">
                <Terminal size={16} className="text-indigo" />
                <span>Supervise only the child processes created by this app</span>
              </div>
            </div>

            <div className="welcome-buttons-row">
              <button
                className="btn-primary btn-lg"
                onClick={() => {
                  setEditingProject(null);
                  setProjectModalOpen(true);
                }}
              >
                <Plus size={18} />
                <span>Add Your First Project</span>
              </button>
            </div>
          </div>
        ) : (
          /* Empty search state */
          <div className="empty-state-card glass-panel animate-fade-in">
            <Search size={32} className="text-muted mb-2" />
            <h3 className="text-lg font-medium text-primary">No Matching Projects Found</h3>
            <p className="text-secondary text-sm mt-1">
              No registered projects match your search query or active filter.
            </p>
            <button
              className="btn-secondary mt-3"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setSelectedTag(null);
              }}
            >
              Reset Filters
            </button>
          </div>
        )}
      </main>

      {/* Modals and Drawers */}
      <ProjectModal
        isOpen={projectModalOpen}
        onClose={() => {
          setProjectModalOpen(false);
          setEditingProject(null);
        }}
        onSave={handleSaveProject}
        editingProject={editingProject}
        existingProjects={projects}
      />

      <ProcessConsoleDrawer
        isOpen={consoleDrawerOpen}
        onClose={() => {
          setConsoleDrawerOpen(false);
          setConsoleProject(null);
          setConsoleRun(null);
        }}
        project={consoleProject}
        run={consoleRun}
        onStopRun={handleStopRun}
      />

      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        onReloadProjects={fetchProjects}
      />

      <OnboardingModal
        isOpen={onboardingModalOpen}
        onClose={() => setOnboardingModalOpen(false)}
        onOpenAddProject={() => {
          setEditingProject(null);
          setProjectModalOpen(true);
        }}
      />

      <RemoveConfirmModal
        isOpen={removeModalOpen}
        onClose={() => {
          setRemoveModalOpen(false);
          setProjectToRemove(null);
        }}
        project={projectToRemove}
        onConfirmRemove={handleConfirmRemove}
      />
    </div>
  );
};
