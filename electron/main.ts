import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import { LocalDatabase } from './db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const devServerUrl = process.env.ELECTRON_RENDERER_URL

let mainWindow: BrowserWindow | null = null
let db: LocalDatabase | null = null

function getDatabase() {
  if (!db) {
    const dbPath = path.join(app.getPath('userData'), 'pos.sqlite')
    db = new LocalDatabase(dbPath)
  }
  return db
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`Renderer failed to load (${errorCode}) ${errorDescription}: ${validatedURL}`)
  })

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`)
  })

  mainWindow.webContents.on('did-finish-load', () => {
    console.log(`Renderer loaded: ${mainWindow?.webContents.getURL()}`)
  })

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('Renderer process gone:', details)
  })

  if (devServerUrl) {
    try {
      await mainWindow.loadURL(devServerUrl)
      return
    } catch (error) {
      console.warn(`Failed to load dev server URL (${devServerUrl}). Falling back to local dist build.`, error)
    }
  }

  await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }
}

function registerIpc() {
  ipcMain.handle('app:health', () => ({ ok: true, runtime: 'electron' }))
  ipcMain.handle('app:meta', () => ({ version: app.getVersion(), platform: process.platform }))

  ipcMain.handle('auth:login', (_event, email: string, password: string) => {
    const user = getDatabase().login(email, password)
    if (!user) throw new Error('Invalid email or password')
    return user
  })
  ipcMain.handle('users:list', () => getDatabase().listUsers())
  ipcMain.handle('users:create', (_event, payload) => getDatabase().createUser(payload))
  ipcMain.handle('users:update', (_event, id: string, payload) => getDatabase().updateUser(id, payload))
  ipcMain.handle('users:set-active', (_event, id: string, isActive: boolean) => getDatabase().setUserActive(id, isActive))

  ipcMain.handle('menu:list', () => getDatabase().getMenuItems())
  ipcMain.handle('menu:today', () => getDatabase().getTodayMenuItems())
  ipcMain.handle('categories:list', () => getDatabase().getCategories())
  ipcMain.handle('menu:create', (_event, payload) => getDatabase().createMenuItem(payload))
  ipcMain.handle('menu:update', (_event, id: string, updates) => getDatabase().updateMenuItem(id, updates))
  ipcMain.handle('menu:delete', (_event, id: string) => getDatabase().deleteMenuItem(id))
  ipcMain.handle('menu:toggle-today', (_event, id: string, isTodayMenu: boolean) => getDatabase().toggleTodayMenu(id, isTodayMenu))
  ipcMain.handle('menu:import-csv', (_event, rows) => getDatabase().importMenuItems(rows))

  ipcMain.handle('orders:create', (_event, order, items) => getDatabase().createOrder(order, items))
  ipcMain.handle('orders:complete', (_event, orderId: string, payment) => getDatabase().completeOrder(orderId, payment))
  ipcMain.handle('orders:recent', (_event, limit: number) => getDatabase().getRecentOrders(limit))
  ipcMain.handle('orders:update-status', (_event, orderId: string, status: string) => getDatabase().updateOrderStatus(orderId, status))
  ipcMain.handle('reports:revenue', (_event, startDate?: string, endDate?: string) => getDatabase().getRevenueStats(startDate, endDate))

  ipcMain.handle('system:backup', async () => {
    const source = getDatabase().getPath()
    const defaultPath = path.join(app.getPath('documents'), `ate-lories-pos-backup-${Date.now()}.sqlite`)
    const result = await dialog.showSaveDialog({
      title: 'Save Database Backup',
      defaultPath,
      filters: [{ name: 'SQLite DB', extensions: ['sqlite', 'db'] }]
    })
    if (result.canceled || !result.filePath) return { canceled: true }
    fs.copyFileSync(source, result.filePath)
    return { canceled: false, path: result.filePath }
  })

  ipcMain.handle('system:restore', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Restore Database Backup',
      properties: ['openFile'],
      filters: [{ name: 'SQLite DB', extensions: ['sqlite', 'db'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return { canceled: true }

    const source = result.filePaths[0]
    const destination = getDatabase().getPath()
    db?.close()
    db = null
    fs.copyFileSync(source, destination)
    getDatabase()
    return { canceled: false, path: source }
  })

  ipcMain.handle('system:integrity', () => ({
    ok: getDatabase().integrityCheck(),
    path: getDatabase().getPath()
  }))
}

app.whenReady().then(() => {
  getDatabase()
  registerIpc()
  void createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  db?.close()
})
