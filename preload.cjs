const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('clipboardAPI', {
  onText: (callback) => { ipcRenderer.on('clipboard-text', (_event, text) => callback(text)) },
  onImage: (callback) => { ipcRenderer.on('clipboard-image', (_event, dataUrl) => callback(dataUrl)) },
  getCurrent: () => ipcRenderer.invoke('get-clipboard'),
})
