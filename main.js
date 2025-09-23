// main.js
const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1080,
    minWidth: 900,
    minHeight: 600,
    frame: false,                   // 🚫 去掉系統標題列，改用自訂 topbar
    titleBarStyle: 'hidden',        // Mac 也能乾淨
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // 載入你的前端（改成你的 HTML）
  mainWindow.loadFile('index.html');

  // DevTools（開發時用，正式可註解）
  // mainWindow.webContents.openDevTools();
}

// ------------------------
// App lifecycle
// ------------------------
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // macOS 習慣不會馬上關閉 app
  if (process.platform !== 'darwin') app.quit();
});

// ------------------------
// IPC handlers
// ------------------------

// 視窗控制
ipcMain.handle('win:minimize', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.minimize();
});

ipcMain.handle('win:toggleMax', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  }
});

ipcMain.handle('win:close', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.close();
});

// 打開資料夾
ipcMain.handle('open-folder', async (_e, folderPath) => {
  try {
    await shell.openPath(folderPath);
    return true;
  } catch (err) {
    console.error('open-folder error:', err);
    return false;
  }
});

// 選擇資料夾
ipcMain.handle('choose-folder', async () => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return null;

  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory']
  });

  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

// Zoom
ipcMain.handle('win:zoom', (_e, dir) => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return;
  const wc = win.webContents;
  const cur = wc.getZoomLevel();
  wc.setZoomLevel(dir === 'in' ? cur + 0.5 : cur - 0.5);
});

// 外部連結
ipcMain.handle('open-external', (_e, url) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
    return shell.openExternal(url);
  }
});

// About（簡單版）
ipcMain.handle('show-about', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return;
  const detail = `KeySearch
Version ${app.getVersion()}

A lightweight knowledge manager.`;
  dialog.showMessageBox(win, { type: 'info', title: 'About KeySearch', message: 'About KeySearch', detail, buttons: ['OK'] });
});