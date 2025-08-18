const { app, BrowserWindow, ipcMain } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')
const fs = require('fs')

// Check if running in development
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// Disable features that require ffmpeg
app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor')
app.commandLine.appendSwitch('disable-background-media-tasks')
app.commandLine.appendSwitch('disable-renderer-backgrounding')

try {
  require('electron-reloader')(module)
} catch (_) {}

// Configure auto-updater (only in production)
if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify()
}

// Auto-updater events
autoUpdater.on('checking-for-update', () => {
    console.log('Checking for update...')
})

autoUpdater.on('update-available', (info) => {
    console.log('Update available.')
    if (myWindow) {
        myWindow.webContents.send('update-available', info)
    }
})

autoUpdater.on('update-not-available', (info) => {
    console.log('Update not available.')
})

autoUpdater.on('error', (err) => {
    console.log('Error in auto-updater. ' + err)
})

autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "Download speed: " + progressObj.bytesPerSecond
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%'
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')'
    console.log(log_message)
    if (myWindow) {
        myWindow.webContents.send('download-progress', progressObj)
    }
})

autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded')
    if (myWindow) {
        myWindow.webContents.send('update-downloaded', info)
    }
})

// Paths to store data
const tasksFilePath = path.join(__dirname, 'tasks.json')
const tabsFilePath = path.join(__dirname, 'tabs.json')

let myWindow;

app.whenReady().then(() => {
    myWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false,
            enableRemoteModule: false,
            // Disable media features that require ffmpeg
            webgl: false,
            plugins: false
        },
        frame: false, // Frameless window for custom title bar
        transparent: false,
        resizable: true,
        minWidth: 400,
        minHeight: 300,
        show: false, // Don't show window until ready
        backgroundColor: '#1e1e1e', // Match your dark theme
        titleBarStyle: 'hidden',
        icon: path.join(__dirname, 'assets', 'notedLogo.svg') // Add your logo icon
    });

    // Set up IPC handlers for window controls
    ipcMain.on('window-controls', (event, action, data) => {
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
            case 'set-zoom':
                if (data && typeof data === 'number') {
                    myWindow.webContents.setZoomFactor(data);
                }
                break;
            case 'toggle-pin':
                const isCurrentlyOnTop = myWindow.isAlwaysOnTop();
                myWindow.setAlwaysOnTop(!isCurrentlyOnTop);
                // Send the new state back to renderer
                myWindow.webContents.send('pin-state-changed', !isCurrentlyOnTop);
                break;
        }
    });

    // IPC handler for saving tasks
    ipcMain.handle('save-tasks', async (event, tasks) => {
        try {
            await fs.promises.writeFile(tasksFilePath, JSON.stringify(tasks, null, 2));
            console.log('Tasks saved successfully to:', tasksFilePath);
            return { success: true };
        } catch (error) {
            console.error('Error saving tasks:', error);
            return { success: false, error: error.message };
        }
    });

    // IPC handler for loading tasks
    ipcMain.handle('load-tasks', async () => {
        try {
            if (fs.existsSync(tasksFilePath)) {
                const data = await fs.promises.readFile(tasksFilePath, 'utf8');
                const tasks = JSON.parse(data);
                console.log('Tasks loaded successfully from:', tasksFilePath);
                return { success: true, tasks };
            } else {
                console.log('No tasks file found, starting with empty tasks');
                return { success: true, tasks: [] };
            }
        } catch (error) {
            console.error('Error loading tasks:', error);
            return { success: false, error: error.message };
        }
    });

    // IPC handler for saving tabs
    ipcMain.handle('save-tabs', async (event, tabs) => {
        try {
            await fs.promises.writeFile(tabsFilePath, JSON.stringify(tabs, null, 2));
            console.log('Tabs saved successfully to:', tabsFilePath);
            return { success: true };
        } catch (error) {
            console.error('Error saving tabs:', error);
            return { success: false, error: error.message };
        }
    });

    // IPC handler for loading tabs
    ipcMain.handle('load-tabs', async () => {
        try {
            if (fs.existsSync(tabsFilePath)) {
                const data = await fs.promises.readFile(tabsFilePath, 'utf8');
                const tabs = JSON.parse(data);
                console.log('Tabs loaded successfully from:', tabsFilePath);
                return { success: true, tabs };
            } else {
                console.log('No tabs file found, starting with empty tabs');
                return { success: true, tabs: {} };
            }
        } catch (error) {
            console.error('Error loading tabs:', error);
            return { success: false, error: error.message };
        }
    });

    // Auto-updater IPC handler
    ipcMain.handle('restart-app', () => {
        autoUpdater.quitAndInstall()
    })

    // IPC handler for zoom level changes
    ipcMain.on('set-zoom-level', (event, zoomLevel) => {
        if (myWindow && myWindow.webContents) {
            // Set zoom factor (zoomLevel is percentage, so divide by 100)
            const zoomFactor = zoomLevel / 100;
            myWindow.webContents.setZoomFactor(zoomFactor);
        }
    });

    // Handle window close event to save data
    myWindow.on('close', async (event) => {
        // Prevent immediate close
        event.preventDefault();
        
        // Request data from renderer and save them
        try {
            myWindow.webContents.send('request-data-for-save');
            
            // Wait a bit for the renderer to respond
            setTimeout(() => {
                myWindow.destroy();
            }, 100);
        } catch (error) {
            console.error('Error during close:', error);
            myWindow.destroy();
        }
    });
    
    // Show window when renderer is fully ready
    ipcMain.on('renderer-ready', () => {
        myWindow.show();
    });
    
    // Remove the menu bar
    myWindow.setMenuBarVisibility(false);

    // Initialize auto-updater (only in production)
    if (!isDev) {
        // Check for updates 5 seconds after the app starts
        setTimeout(() => {
            autoUpdater.checkForUpdatesAndNotify()
        }, 5000)
    }

    myWindow.loadFile('index.html');
    
    // Fallback: show window after 1 second if renderer-ready hasn't fired
    setTimeout(() => {
        if (!myWindow.isVisible()) {
            myWindow.show();
        }
    }, 1000);
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
})
