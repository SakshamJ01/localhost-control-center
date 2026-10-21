import { Shield, Eye, Lock, HardDrive, CheckCircle, X, Cpu } from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAddProject: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onOpenAddProject
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-content glass-panel animate-slide-up max-w-lg">
        <div className="modal-header">
          <div className="modal-title-group">
            <h2 className="modal-title flex-row items-center gap-2">
              <Shield size={20} className="text-cyan" />
              Localhost Principles & Privacy
            </h2>
            <p className="modal-subtitle">
              A calm, honest control panel for your local services.
            </p>
          </div>
          <button className="icon-close-btn" onClick={onClose} aria-label="Close guide">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body onboarding-body">
          <div className="principle-card">
            <HardDrive size={22} className="principle-icon text-cyan" />
            <div>
              <h4 className="principle-title">100% Local-First</h4>
              <p className="principle-desc">
                Everything runs right on your computer. Localhost requires no cloud account, sends no telemetry, and works seamlessly offline.
              </p>
            </div>
          </div>

          <div className="principle-card">
            <Eye size={22} className="principle-icon text-emerald" />
            <div>
              <h4 className="principle-title">Explicit Actions & Least Privilege</h4>
              <p className="principle-desc">
                No automatic background repo crawling. Localhost only runs commands that you explicitly author, without elevated privileges, and clearly previews every executable and argument before launch.
              </p>
            </div>
          </div>

          <div className="principle-card">
            <Lock size={22} className="principle-icon text-indigo" />
            <div>
              <h4 className="principle-title">Your Source Code Remains Untouched</h4>
              <p className="principle-desc">
                App metadata is kept in your OS user directory. Removing a project card from Localhost will <strong>never</strong> delete or touch your source files or git history.
              </p>
            </div>
          </div>

          <div className="principle-card">
            <Cpu size={22} className="principle-icon text-amber" />
            <div>
              <h4 className="principle-title">App-Owned Child Processes Only</h4>
              <p className="principle-desc">
                Localhost supervises only the processes it creates. It will never randomly kill processes by port number or tamper with other software on your machine.
              </p>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Got It
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              onClose();
              onOpenAddProject();
            }}
          >
            <CheckCircle size={16} />
            <span>Add Your First Project</span>
          </button>
        </div>
      </div>
    </div>
  );
};
