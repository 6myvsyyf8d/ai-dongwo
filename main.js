const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, shell } = require('electron');
const path = require('path');

let mainWindow = null;
let tray = null;
let isQuiting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, 'build', 'icon.png'),
    title: 'AI懂我 - 心智障碍者动态支持档案',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('close', function (event) {
    if (!isQuiting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });

  mainWindow.on('minimize', function (event) {
    event.preventDefault();
    mainWindow.hide();
    return false;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'build', 'icon.png');
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) {
      trayIcon = nativeImage.createEmpty();
    }
  } catch (e) {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('AI懂我 - 心智障碍者动态支持档案');

  updateTrayMenu();

  tray.on('click', function () {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

function updateTrayMenu() {
  const isAutoLaunch = app.getLoginItemSettings().openAtLogin;
  const menu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: function () {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: '开机自启动',
      type: 'checkbox',
      checked: isAutoLaunch,
      click: function (item) {
        app.setLoginItemSettings({
          openAtLogin: item.checked,
          args: ['--auto-launch']
        });
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: function () {
        isQuiting = true;
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(menu);
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', function () {
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show();
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(function () {
    createWindow();
    createTray();
    updateTrayMenu();
  });
}

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

app.on('before-quit', function () {
  isQuiting = true;
});

ipcMain.on('focus-window', function () {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});

ipcMain.handle('check-notification-permission', function () {
  return true;
});