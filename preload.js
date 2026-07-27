const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  focusWindow: function () {
    ipcRenderer.send('focus-window');
  },
  isElectron: true
});