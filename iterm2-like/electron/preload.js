import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('terminal', {
  create: (opts) => ipcRenderer.invoke('terminal:create', opts || {}),
  write: (id, data) => ipcRenderer.send('terminal:write', { id, data }),
  resize: (id, cols, rows) => ipcRenderer.send('terminal:resize', { id, cols, rows }),
  close: (id) => ipcRenderer.send('terminal:close', { id }),
  onData: (listener) => ipcRenderer.on('terminal:data', (_, payload) => listener(payload)),
  onExit: (listener) => ipcRenderer.on('terminal:exit', (_, payload) => listener(payload)),
  onCreated: (listener) => ipcRenderer.on('terminal:created', (_, payload) => listener(payload)),
})

contextBridge.exposeInMainWorld('layout', {
  save: (layout) => ipcRenderer.invoke('layout:save', layout),
  load: () => ipcRenderer.invoke('layout:load'),
})