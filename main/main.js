const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
try {
  require('electron-reloader')(module)
} catch (_) {}

app.whenReady().then(() => {
    const myWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        frame: true, // use for frameless window
        transparent: false,
        resizable: true,
        minWidth: 800,
        minHeight: 600
    });

    // Set up IPC handlers for window controls
    ipcMain.on('window-controls', (event, action) => {
        switch(action) {
            case 'minimize':
                myWindow.minimize();
                break;
            case 'maximize':
                if (myWindow.isMaximized()) {
                    myWindow.unmaximize();
                } else {
                    myWindow.maximize();
                }
                break;
            case 'close':
                myWindow.close();
                break;
        }
    });
    
    // Remove the menu bar
    myWindow.setMenuBarVisibility(false);

    myWindow.loadFile('index.html');
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
})
