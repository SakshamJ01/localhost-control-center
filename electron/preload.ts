import { contextBridge, ipcRenderer } from 'electron';
import { LocalhostApi, Project, ProcessRun, OutputChunk, AppSettings } from '../src/types';

const api: LocalhostApi = {
  getDataDir: () => ipcRenderer.invoke('localhost:get-data-dir'),
  selectFolder: () => ipcRenderer.invoke('localhost:select-folder'),
  detectProject: (folderPath: string) => ipcRenderer.invoke('localhost:detect-project', folderPath),
  listProjects: () => ipcRenderer.invoke('localhost:list-projects'),
  addProject: (data) => ipcRenderer.invoke('localhost:add-project', data),
  updateProject: (id, data) => ipcRenderer.invoke('localhost:update-project', id, data),
  removeProject: (id) => ipcRenderer.invoke('localhost:remove-project', id),
  openFolder: (id) => ipcRenderer.invoke('localhost:open-folder', id),
  openUrl: (id) => ipcRenderer.invoke('localhost:open-url', id),
  previewLaunch: (id) => ipcRenderer.invoke('localhost:preview-launch', id),
  startProject: (id) => ipcRenderer.invoke('localhost:start-project', id),
  stopRun: (runId) => ipcRenderer.invoke('localhost:stop-run', runId),
  getRuns: () => ipcRenderer.invoke('localhost:get-runs'),
  getRunOutput: (runId) => ipcRenderer.invoke('localhost:get-run-output', runId),
  getSettings: () => ipcRenderer.invoke('localhost:get-settings'),
  updateSettings: (settings) => ipcRenderer.invoke('localhost:update-settings', settings),
  getAuditLog: () => ipcRenderer.invoke('localhost:get-audit-log'),
  exportConfig: () => ipcRenderer.invoke('localhost:export-config'),
  importConfig: (jsonContent) => ipcRenderer.invoke('localhost:import-config', jsonContent),
  clearAllData: () => ipcRenderer.invoke('localhost:clear-all-data'),

  onProcessOutput: (callback: (chunk: OutputChunk) => void) => {
    const handler = (_event: any, chunk: OutputChunk) => callback(chunk);
    ipcRenderer.on('process-output', handler);
    return () => {
      ipcRenderer.removeListener('process-output', handler);
    };
  },

  onProcessStatusChange: (callback: (run: ProcessRun) => void) => {
    const handler = (_event: any, run: ProcessRun) => callback(run);
    ipcRenderer.on('process-status-change', handler);
    return () => {
      ipcRenderer.removeListener('process-status-change', handler);
    };
  }
};

contextBridge.exposeInMainWorld('localhostApi', api);
