const { app, BrowserWindow, Tray, Menu, nativeImage, clipboard, ipcMain, globalShortcut } = require('electron')
const path = require('path')
const crypto = require('crypto')

let mainWindow = null
let popupWindow = null
let tray = null
let isQuitting = false

function createTray() {
  try {
    tray = new Tray(nativeImage.createEmpty().resize({ width: 16, height: 16 }))
    tray.setToolTip('剪贴板博物馆 — 监控中')
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: '打开窗口', click: () => mainWindow?.show() },
      { label: '快速查看 (Alt+Shift+V)', click: () => showPopup() },
      { type: 'separator' },
      { label: '退出', click: () => { isQuitting = true; app.quit() } },
    ]))
    tray.on('double-click', () => mainWindow?.show())
  } catch (_) {}
}

function showPopup() {
  if (popupWindow && !popupWindow.isDestroyed()) { popupWindow.close() }
  popupWindow = new BrowserWindow({
    width: 380, height: 420, frame: false, resizable: false, alwaysOnTop: true,
    skipTaskbar: true, backgroundColor: '#0a0a0a',
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.cjs') },
  })
  popupWindow.loadFile(path.join(__dirname, 'dist', 'index.html'), { hash: '/popup' })
  popupWindow.on('blur', () => { if (popupWindow && !popupWindow.isDestroyed()) popupWindow.close() })
}

let lastText = ''
let lastImgHash = ''
setInterval(() => {
  try {
    const text = clipboard.readText()
    if (text && text !== lastText && text.length < 50000) {
      lastText = text
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('clipboard-text', text)
      if (popupWindow && !popupWindow.isDestroyed()) popupWindow.webContents.send('clipboard-text', text)
    }
    const img = clipboard.readImage()
    if (!img.isEmpty()) {
      const png = img.toPNG()
      const hash = crypto.createHash('md5').update(png).digest('hex')
      if (hash !== lastImgHash) {
        lastImgHash = hash
        const dataUrl = 'data:image/png;base64,' + png.toString('base64')
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('clipboard-image', dataUrl)
      }
    }
  } catch (_) {}
}, 1500)

ipcMain.handle('get-clipboard', () => { try { return clipboard.readText() || '' } catch { return '' } })

app.whenReady().then(() => {
  createTray()
  mainWindow = new BrowserWindow({
    width: 900, height: 680, minWidth: 600, minHeight: 400,
    title: '剪贴板博物馆', backgroundColor: '#0a0a0a',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false },
  })
  mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'))
  mainWindow.on('close', (e) => { if (!isQuitting) { e.preventDefault(); mainWindow?.hide() } })
  globalShortcut.register('Alt+Shift+V', () => { showPopup() })
  app.setLoginItemSettings({ openAtLogin: true })
})

app.on('window-all-closed', () => {})
app.on('before-quit', () => { isQuitting = true })
app.on('will-quit', () => { globalShortcut.unregisterAll() })
app.on('activate', () => { if (mainWindow) mainWindow.show() })
