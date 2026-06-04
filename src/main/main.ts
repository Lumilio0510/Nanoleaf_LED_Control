import electron from 'electron'
const { app, BrowserWindow, Menu } = electron
import { join } from 'path'
import { registerHandlers } from './ipc-handlers'
import * as deviceService from './device.service'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Softwaves LED Control',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error(`窗口加载失败: ${errorCode} - ${errorDescription}`)
  })

  mainWindow.webContents.openDevTools()

  const devUrl = process.env.ELECTRON_RENDERER_URL || 'http://localhost:5173'
  console.log('Loading URL:', devUrl)
  mainWindow.loadURL(devUrl)
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  registerHandlers()
  deviceService.pingAllDevices().catch(err => console.error('Startup ping failed:', err))
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
