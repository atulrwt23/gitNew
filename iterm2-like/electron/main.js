import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import fs from 'node:fs'

const isDev = process.env.NODE_ENV !== 'production'

/** @type {import('node-pty') | null} */
let nodePty = null
try {
  // Dynamically resolve node-pty when available
  // eslint-disable-next-line
  nodePty = (await import('node-pty')).default || (await import('node-pty'))
} catch (err) {
  nodePty = null
}

const sessions = new Map() // id -> {pty, win}
let win /** @type {BrowserWindow | undefined} */

function getUserDataPath() {
  return app.getPath('userData')
}

function readPersistedLayout() {
  try {
    const p = path.join(getUserDataPath(), 'sessions.json')
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8'))
    }
  } catch {}
  return { tabs: [] }
}

function writePersistedLayout(layout) {
  try {
    const p = path.join(getUserDataPath(), 'sessions.json')
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, JSON.stringify(layout, null, 2))
  } catch {}
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'iterm2-like',
    webPreferences: {
      preload: path.join(app.getAppPath(), 'electron', 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  const url = isDev
    ? new URL(`file://${path.join(app.getAppPath(), 'renderer', 'index.html')}`).toString()
    : new URL(`file://${path.join(app.getAppPath(), 'renderer', 'index.html')}`).toString()

  win.loadURL(url)

  if (isDev) {
    win.webContents.openDevTools({ mode: 'detach' })
  }
}

function getDefaultShell() {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'cmd.exe'
  }
  return process.env.SHELL || '/bin/bash'
}

function createSession({ cols = 80, rows = 24 } = {}) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  if (nodePty) {
    const pty = nodePty.spawn(getDefaultShell(), [], {
      name: 'xterm-color',
      cols,
      rows,
      cwd: process.cwd(),
      env: process.env,
    })
    sessions.set(id, { pty })
    pty.onData((data) => {
      win?.webContents.send('terminal:data', { id, data })
    })
    pty.onExit(() => {
      win?.webContents.send('terminal:exit', { id })
      sessions.delete(id)
    })
  } else {
    // Fallback: simple echo backend
    const echo = {
      write(input) {
        const echoed = input.replace(/\r/g, '')
        win?.webContents.send('terminal:data', { id, data: echoed })
      },
      resize() {},
      kill() {
        win?.webContents.send('terminal:exit', { id })
      },
    }
    sessions.set(id, { pty: echo })
    setTimeout(() => {
      win?.webContents.send('terminal:data', { id, data: 'node-pty not installed. Running in echo mode.\r\n' })
    }, 50)
  }
  return id
}

app.whenReady().then(() => {
  createWindow()

  const persisted = readPersistedLayout()
  if (!persisted.tabs || persisted.tabs.length === 0) {
    // Create one initial session for UX
    const id = createSession()
    win?.webContents.once('did-finish-load', () => {
      win?.webContents.send('terminal:created', { id })
    })
  } else {
    // In a full implementation, recreate sessions here
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// IPC
ipcMain.handle('terminal:create', (evt, { cols, rows }) => {
  const id = createSession({ cols, rows })
  return { id }
})

ipcMain.on('terminal:write', (evt, { id, data }) => {
  const session = sessions.get(id)
  if (session) {
    session.pty.write?.(data)
  }
})

ipcMain.on('terminal:resize', (evt, { id, cols, rows }) => {
  const session = sessions.get(id)
  if (session && session.pty.resize) {
    try { session.pty.resize(cols, rows) } catch {}
  }
})

ipcMain.on('terminal:close', (evt, { id }) => {
  const session = sessions.get(id)
  if (session) {
    try { session.pty.kill() } catch {}
    sessions.delete(id)
  }
})

ipcMain.handle('layout:save', (evt, layout) => {
  writePersistedLayout(layout)
  return { ok: true }
})

ipcMain.handle('layout:load', () => {
  return readPersistedLayout()
})