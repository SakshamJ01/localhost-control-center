import React, { useState, useEffect } from 'react';
import { AppSettings, AuditEvent } from '../types';
import { 
  Settings, 
  Download, 
  Upload, 
  Shield, 
  Database, 
  History, 
  Trash2, 
  Check, 
  AlertTriangle, 
  X, 
  Folder
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReloadProjects: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onReloadProjects
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'export-import' | 'audit'>('general');
  const [dataDir, setDataDir] = useState<string>('');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [importJson, setImportJson] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      window.localhostApi.getDataDir().then(setDataDir);
      window.localhostApi.getSettings().then(setSettings);
      window.localhostApi.getAuditLog().then(setAuditEvents);
      setStatusMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleTerminateOnExit = async () => {
    if (!settings) return;
    const newVal = !settings.terminate_children_on_exit;
    const res = await window.localhostApi.updateSettings({ terminate_children_on_exit: newVal });
    if (res.success) {
      setSettings(res.settings);
      setStatusMessage({ type: 'success', text: 'Shutdown preference updated.' });
    }
  };

  const handleExport = async () => {
    try {
      const json = await window.localhostApi.exportConfig();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `localhost-config-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatusMessage({ type: 'success', text: 'Configuration exported successfully (no secrets included).' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Export failed: ${err.message}` });
    }
  };

  const handleImport = async () => {
    if (!importJson.trim()) {
      setStatusMessage({ type: 'error', text: 'Please paste configuration JSON into the text area.' });
      return;
    }

    try {
      const res = await window.localhostApi.importConfig(importJson.trim());
      if (res.success) {
        setStatusMessage({ type: 'success', text: res.message });
        setImportJson('');
        onReloadProjects();
        window.localhostApi.getAuditLog().then(setAuditEvents);
      } else {
        setStatusMessage({ type: 'error', text: res.message || 'Import failed' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Import error: ${err.message}` });
    }
  };

  const handleClearAllData = async () => {
    if (!window.confirm('Are you sure you want to clear all Localhost metadata? Your physical project folders on disk will remain 100% untouched.')) {
      return;
    }

    setIsResetting(true);
    try {
      await window.localhostApi.clearAllData();
      setStatusMessage({ type: 'success', text: 'All Localhost metadata cleared. Physical files untouched.' });
      onReloadProjects();
      window.localhostApi.getAuditLog().then(setAuditEvents);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Failed to reset: ${err.message}` });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content settings-modal-content glass-panel animate-slide-up">
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <h2 className="modal-title flex-row items-center gap-2">
              <Settings size={20} className="text-cyan" />
              Settings & Control Center Data
            </h2>
            <p className="modal-subtitle">
              Local configuration, audit logs, and safe non-secret data portability.
            </p>
          </div>
          <button className="icon-close-btn" onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
        </div>

        {/* Status Alert Banner */}
        {statusMessage && (
          <div className={`alert-box ${statusMessage.type === 'success' ? 'alert-success' : 'alert-error'} my-3`}>
            {statusMessage.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="tab-nav-bar">
          <button
            className={`tab-btn ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            <Shield size={15} />
            <span>Preferences & Storage</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'export-import' ? 'active' : ''}`}
            onClick={() => setActiveTab('export-import')}
          >
            <Download size={15} />
            <span>Safe Export & Import</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            <History size={15} />
            <span>Audit Trail</span>
          </button>
        </div>

        {/* Tab 1: General Preferences */}
        {activeTab === 'general' && (
          <div className="settings-tab-content">
            <div className="settings-section">
              <h3 className="section-heading flex-row gap-2">
                <Database size={16} className="text-cyan" />
                Local Storage Location
              </h3>
              <p className="section-subtext">
                All Localhost configuration and metadata is kept exclusively in your OS user directory:
              </p>
              <div className="data-path-display">
                <Folder size={16} className="text-muted" />
                <code>{dataDir || 'Loading...'}</code>
              </div>
              <span className="text-xs text-muted block mt-1">
                Zero cloud syncing. No background telemetry or code indexing.
              </span>
            </div>

            <div className="settings-section mt-4">
              <h3 className="section-heading flex-row gap-2">
                <Shield size={16} className="text-emerald" />
                Process Lifecycle Policy
              </h3>
              <div className="toggle-setting-row">
                <div>
                  <div className="setting-label">Terminate app-owned child processes on exit</div>
                  <div className="setting-desc">
                    When enabled, closing Localhost safely terminates any services started by this app.
                  </div>
                </div>
                <input
                  type="checkbox"
                  className="toggle-checkbox"
                  checked={settings?.terminate_children_on_exit ?? true}
                  onChange={handleToggleTerminateOnExit}
                />
              </div>
            </div>

            <div className="settings-section mt-4 danger-section">
              <h3 className="section-heading text-rose flex-row gap-2">
                <Trash2 size={16} />
                Clear Metadata (Reset App)
              </h3>
              <p className="section-subtext">
                Removes all registered project cards and settings from Localhost. This action will <strong>never</strong> delete or alter any files inside your source repositories.
              </p>
              <button
                className="btn-danger-outline mt-2"
                onClick={handleClearAllData}
                disabled={isResetting}
              >
                {isResetting ? 'Clearing...' : 'Clear All Localhost Metadata'}
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Export & Import */}
        {activeTab === 'export-import' && (
          <div className="settings-tab-content">
            <div className="settings-section">
              <h3 className="section-heading flex-row gap-2">
                <Download size={16} className="text-cyan" />
                Export Project Configuration
              </h3>
              <p className="section-subtext">
                Export project names, canonical paths, tags, and launch definitions. Secrets and environment variable values are never stored or exported.
              </p>
              <button className="btn-secondary mt-2 flex-row gap-2" onClick={handleExport}>
                <Download size={16} />
                <span>Export Configuration JSON</span>
              </button>
            </div>

            <div className="settings-section mt-4">
              <h3 className="section-heading flex-row gap-2">
                <Upload size={16} className="text-cyan" />
                Safe Import Configuration
              </h3>
              <div className="alert-box alert-info my-2 text-xs">
                <Shield size={14} />
                <span>
                  <strong>Security Guard:</strong> For your protection, all imported launch commands will be marked as <strong>Disabled</strong> until you manually review and enable them.
                </span>
              </div>
              <textarea
                className="import-textarea font-mono text-xs"
                rows={5}
                value={importJson}
                onChange={e => setImportJson(e.target.value)}
                placeholder="Paste valid Localhost configuration JSON here..."
              />
              <button className="btn-primary mt-2 flex-row gap-2" onClick={handleImport}>
                <Upload size={16} />
                <span>Import and Review Projects</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Audit Trail */}
        {activeTab === 'audit' && (
          <div className="settings-tab-content">
            <h3 className="section-heading flex-row gap-2 mb-2">
              <History size={16} className="text-cyan" />
              Local Audit Event History
            </h3>
            <p className="section-subtext mb-3">
              Transparent local log of process launches, stops, and project configurations:
            </p>

            <div className="audit-log-list">
              {auditEvents.length === 0 ? (
                <div className="text-muted text-sm py-4 text-center">No audit events recorded yet.</div>
              ) : (
                auditEvents.map(evt => (
                  <div key={evt.id} className="audit-event-card">
                    <div className="audit-header">
                      <span className="audit-badge">{evt.event_type.replace('_', ' ')}</span>
                      <span className="audit-time">{new Date(evt.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="audit-details">{evt.details}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
