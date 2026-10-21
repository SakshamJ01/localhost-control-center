import React, { useState } from 'react';
import { ProjectWithState } from '../types';
import { Trash2, AlertTriangle, X, ShieldCheck } from 'lucide-react';

interface RemoveConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectWithState | null;
  onConfirmRemove: (id: string) => Promise<void>;
}

export const RemoveConfirmModal: React.FC<RemoveConfirmModalProps> = ({
  isOpen,
  onClose,
  project,
  onConfirmRemove
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !project) return null;

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirmRemove(project.id);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content glass-panel animate-slide-up max-w-md">
        <div className="modal-header">
          <div className="modal-title-group">
            <h2 className="modal-title text-rose flex-row items-center gap-2">
              <Trash2 size={20} />
              Remove Project Card
            </h2>
            <p className="modal-subtitle">
              Remove "{project.name}" from your Localhost dashboard.
            </p>
          </div>
          <button className="icon-close-btn" onClick={onClose} aria-label="Cancel">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body py-2">
          <div className="safe-removal-notice">
            <ShieldCheck size={20} className="text-emerald flex-shrink-0" />
            <div className="text-sm">
              <strong>Your source files are 100% safe.</strong> Removing this project only deletes Localhost's registered configuration. Your physical folder at <code>{project.canonical_path}</code> will remain completely untouched.
            </div>
          </div>

          {project.active_run?.status === 'running_by_app' && (
            <div className="alert-box alert-warning text-xs mt-3">
              <AlertTriangle size={14} />
              <span>
                Note: This project is currently running (PID {project.active_run.pid}). Removing it will safely stop the running child process.
              </span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={isDeleting}>
            Keep Project
          </button>
          <button className="btn-danger" onClick={handleConfirm} disabled={isDeleting}>
            <Trash2 size={16} />
            <span>{isDeleting ? 'Removing...' : 'Remove Card'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
