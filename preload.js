const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  focusWindow: function () {
    ipcRenderer.send('focus-window');
  },
  isElectron: true,
  getEnv: function (key) {
    return process.env[key] || null;
  }
});