const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 既有
  winMinimize: () => ipcRenderer.invoke('win:minimize'),
  winToggleMax: () => ipcRenderer.invoke('win:toggleMax'),
  winClose: () => ipcRenderer.invoke('win:close'),
  openFolder: (p) => ipcRenderer.invoke('open-folder', p),
  chooseFolder: () => ipcRenderer.invoke('choose-folder'),

  // 新增
  zoom: (dir) => ipcRenderer.invoke('win:zoom', dir),              // 'in' | 'out'
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  showAbout: () => ipcRenderer.invoke('show-about')
});