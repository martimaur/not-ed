const { app, BrowserWindow, ipcMain } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')
const fs = require('fs')

// Get version from package.json
const packageInfo = require('./package.json')
const APP_VERSION = packageInfo.version

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
console.log('Environment check:')
console.log('- NODE_ENV:', process.env.NODE_ENV)
console.log('- app.isPackaged:', app.isPackaged)
console.log('- isDev:', isDev)
console.log('- Current version:', APP_VERSION)

if (!isDev) {
    console.log('Production mode - Auto-updater enabled')
    
    // Configure auto-updater settings
    autoUpdater.setFeedURL({
        provider: 'github',
        owner: 'martimaur',
        repo: 'not-ed'
    })
    
    autoUpdater.autoDownload = true // Enable auto-download
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.allowDowngrade = false
    autoUpdater.allowPrerelease = false
    
    console.log('Auto-updater configured for: martimaur/not-ed')
} else {
    console.log('Development mode - Auto-updater disabled')
}

// Auto-updater events
autoUpdater.on('checking-for-update', () => {
    console.log('Checking for update...')
    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.webContents.send('splash-status', 'Checking for updates...')
        splashWindow.webContents.send('splash-progress', -1) // Indeterminate
    }
})

autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version)
    updateAvailable = true
    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.webContents.send('splash-status', `Downloading update v${info.version}...`)
        splashWindow.webContents.send('splash-progress', 0)
    }
    if (myWindow && !myWindow.isDestroyed()) {
        myWindow.webContents.send('update-available', info)
    }
})

autoUpdater.on('download-progress', (progressObj) => {
    if (splashWindow && !splashWindow.isDestroyed()) {
        const percent = Math.round(progressObj.percent)
        splashWindow.webContents.send('splash-status', `Downloading update... ${percent}%`)
        splashWindow.webContents.send('splash-progress', percent)
    }
})

autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded')
    updateDownloaded = true
    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.webContents.send('splash-status', 'Update ready - Restarting...')
        splashWindow.webContents.send('splash-progress', 100)
    }
    
    // Close the splash window before restarting
    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close()
    }
    
    // Automatically install and restart with explicit options
    setTimeout(() => {
        autoUpdater.quitAndInstall(true, true) // Restart immediately after install
    }, 1000)
})

autoUpdater.on('update-not-available', (info) => {
    console.log('Update not available.')
    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.webContents.send('splash-status', 'No updates available')
        setTimeout(() => {
            if (splashWindow && !splashWindow.isDestroyed()) {
                splashWindow.webContents.send('splash-status', 'Starting application...')
                setTimeout(() => {
                    createMainWindow()
                    if (splashWindow && !splashWindow.isDestroyed()) {
                        splashWindow.webContents.send('splash-close')
                    }
                }, 1000)
            } else {
                createMainWindow()
            }
        }, 1000) // Back to 1 second
    } else {
        createMainWindow()
    }
})

autoUpdater.on('error', (err) => {
    console.log('Auto-updater error:', err.message || err)
    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.webContents.send('splash-status', 'Starting application...')
        setTimeout(() => {
            createMainWindow()
            if (splashWindow && !splashWindow.isDestroyed()) {
                splashWindow.webContents.send('splash-close')
            }
        }, 1000) // Back to 1 second
    } else {
        createMainWindow()
    }
})

autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "Download speed: " + progressObj.bytesPerSecond
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%'
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')'
    console.log(log_message)
    
    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.webContents.send('splash-progress', Math.round(progressObj.percent))
        splashWindow.webContents.send('splash-status', `Downloading update... ${Math.round(progressObj.percent)}%`)
    }
    if (myWindow && !myWindow.isDestroyed()) {
        myWindow.webContents.send('download-progress', progressObj)
    }
})

autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded')
    updateDownloaded = true
    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.webContents.send('splash-status', 'Update ready - Restarting...')
        setTimeout(() => {
            autoUpdater.quitAndInstall(true, true) // Restart immediately after install
        }, 2000)
    }
    if (myWindow && !myWindow.isDestroyed()) {
        myWindow.webContents.send('update-downloaded', info)
    }
})

// Paths to store data - use userData directory to preserve data across updates
const userDataPath = app.getPath('userData')
const tasksFilePath = path.join(userDataPath, 'tasks.json')
const tabsFilePath = path.join(userDataPath, 'tabs.json')

// Ensure userData directory exists
if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true })
}

// Migrate existing tabs.json from app directory to userData directory
const oldTabsPath = path.join(__dirname, 'tabs.json')
if (fs.existsSync(oldTabsPath) && !fs.existsSync(tabsFilePath)) {
    try {
        const tabsData = fs.readFileSync(oldTabsPath, 'utf8')
        fs.writeFileSync(tabsFilePath, tabsData)
        console.log('Migrated tabs.json to userData directory')
        // Don't delete the old file immediately in case of issues
    } catch (error) {
        console.error('Error migrating tabs.json:', error)
    }
}

// Migrate existing tasks.json from app directory to userData directory
const oldTasksPath = path.join(__dirname, 'tasks.json')
if (fs.existsSync(oldTasksPath) && !fs.existsSync(tasksFilePath)) {
    try {
        const tasksData = fs.readFileSync(oldTasksPath, 'utf8')
        fs.writeFileSync(tasksFilePath, tasksData)
        console.log('Migrated tasks.json to userData directory')
        // Don't delete the old file immediately in case of issues
    } catch (error) {
        console.error('Error migrating tasks.json:', error)
    }
}

let myWindow;
let splashWindow;
let updateAvailable = false;
let updateDownloaded = false;
let mainWindowCreated = false;

app.whenReady().then(() => {
    setupIpcHandlers(); // Set up IPC handlers once
    createSplashWindow();
});

// Set up all IPC handlers once when app starts
function setupIpcHandlers() {
    // Remove any existing handlers to prevent duplicates
    ipcMain.removeAllListeners('save-tasks');
    ipcMain.removeAllListeners('load-tasks');
    ipcMain.removeAllListeners('save-tabs');
    ipcMain.removeAllListeners('load-tabs');
    ipcMain.removeAllListeners('restart-app');
    ipcMain.removeAllListeners('check-for-updates');
    ipcMain.removeAllListeners('splash-ready');
    ipcMain.removeAllListeners('splash-finished');
    ipcMain.removeAllListeners('renderer-ready');
    ipcMain.removeAllListeners('set-zoom-level');
    ipcMain.removeAllListeners('window-controls');

    // IPC handler for manual update check
    ipcMain.handle('check-for-updates-manual', async () => {
        if (isDev) {
            return { error: 'Updates disabled in development mode' };
        }
        
        try {
            console.log('Manual update check requested');
            const result = await autoUpdater.checkForUpdates();
            return { success: true, result };
        } catch (error) {
            console.log('Manual update check error:', error);
            return { error: error.message };
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
        autoUpdater.quitAndInstall(true, true) // Restart immediately after install
    })

    // Manual update check for testing
    ipcMain.handle('check-for-updates', () => {
        console.log('Manual update check triggered')
        autoUpdater.checkForUpdatesAndNotify()
    })

    // Get app version
    ipcMain.handle('get-app-version', () => {
        return APP_VERSION
    })

    // Splash screen IPC handlers
    ipcMain.on('splash-ready', () => {
        console.log('Splash screen ready')
    })

    ipcMain.on('splash-finished', () => {
        if (splashWindow && !splashWindow.isDestroyed()) {
            splashWindow.close()
            splashWindow = null
        }
        if (myWindow && !myWindow.isDestroyed()) {
            myWindow.show()
        }
    })

    // Show window when renderer is fully ready
    ipcMain.on('renderer-ready', () => {
        if (myWindow && !myWindow.isDestroyed()) {
            myWindow.show()
        }
    })

    // IPC handler for zoom level changes
    ipcMain.on('set-zoom-level', (event, zoomLevel) => {
        if (myWindow && !myWindow.isDestroyed() && myWindow.webContents) {
            // Set zoom factor (zoomLevel is percentage, so divide by 100)
            const zoomFactor = zoomLevel / 100;
            myWindow.webContents.setZoomFactor(zoomFactor);
        }
    })

    // Set up window controls handler
    ipcMain.on('window-controls', (event, action, data) => {
        if (!myWindow || myWindow.isDestroyed()) return;
        
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
                if (!myWindow.isDestroyed()) {
                    myWindow.webContents.send('pin-state-changed', !isCurrentlyOnTop);
                }
                break;
        }
    });
}

function createSplashWindow() {
    splashWindow = new BrowserWindow({
        width: 400,
        height: 300,
        frame: false,
        alwaysOnTop: true,
        transparent: false,
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        show: false
    });

    splashWindow.loadFile('splash.html');
    
    splashWindow.once('ready-to-show', () => {
        splashWindow.show();
        
        if (!isDev) {
            startUpdateProcess();
        } else {
            // In development, skip update check and go straight to main app
            splashWindow.webContents.send('splash-status', 'Development mode - Starting application...');
            setTimeout(() => {
                createMainWindow();
                splashWindow.webContents.send('splash-close');
            }, 2000); // Back to 2 seconds
        }
    });
}

function createMainWindow() {
    if (mainWindowCreated) return; // Prevent multiple windows
    mainWindowCreated = true;
    
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

    // Handle window close event to save data
    myWindow.on('close', async (event) => {                        
        // Prevent immediate close
        event.preventDefault();
        
        // Request data from renderer and save them
        try {
            if (!myWindow.isDestroyed()) {
                myWindow.webContents.send('request-data-for-save');
            }
            
            // Wait a bit for the renderer to respond
            setTimeout(() => {
                if (myWindow && !myWindow.isDestroyed()) {
                    myWindow.destroy();
                }
            }, 100);
            
            // Force close after 2 seconds if renderer doesn't respond
            setTimeout(() => {
                if (myWindow && !myWindow.isDestroyed()) {
                    console.log('Force closing window after timeout');
                    myWindow.destroy();
                }
            }, 2000);
        } catch (error) {
            console.error('Error during close:', error);
            if (myWindow && !myWindow.isDestroyed()) {
                myWindow.destroy();
            }
        }
    });
    
    // Remove the menu bar
    myWindow.setMenuBarVisibility(false);

    myWindow.loadFile('index.html');
    
    // Fallback: show window after 1 second if renderer-ready hasn't fired
    setTimeout(() => {
        if (myWindow && !myWindow.isVisible()) {
            myWindow.show();
        }
    }, 1000);
}

function startUpdateProcess() {
    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.webContents.send('splash-status', 'Checking for updates...')
    }
    
    if (!isDev) {
        // Start checking for updates
        setTimeout(() => {
            autoUpdater.checkForUpdatesAndNotify()
        }, 1000)

        // If no update found after 10 seconds, proceed to main app
        setTimeout(() => {
            if (!updateAvailable && !updateDownloaded && !mainWindowCreated) {
                if (splashWindow && !splashWindow.isDestroyed()) {
                    splashWindow.webContents.send('splash-status', 'Starting application...')
                }
                setTimeout(() => {
                    createMainWindow()
                    if (splashWindow && !splashWindow.isDestroyed()) {
                        splashWindow.webContents.send('splash-close')
                    }
                }, 1000)
            }
        }, 10000) // Back to 10 seconds
    }
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
