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
    
    console.log('Auto-updater configured for: martimaur/not-ed')
} else {
    console.log('Development mode - Auto-updater disabled')
}

// Auto-updater events
autoUpdater.on('checking-for-update', () => {
    const msg = `🔍 Checking for update... Current: ${APP_VERSION}, Repo: martimaur/not-ed`
    console.log(msg)
    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.webContents.send('splash-status', 'Checking for updates...')
        splashWindow.webContents.send('splash-progress', -1) // Indeterminate
        splashWindow.webContents.send('splash-debug', msg)
    }
})

autoUpdater.on('update-available', (info) => {
    const msg = `✅ Update available: v${info.version}`
    console.log(msg)
    updateAvailable = true
    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.webContents.send('splash-status', `Downloading update v${info.version}...`)
        splashWindow.webContents.send('splash-progress', 0)
        splashWindow.webContents.send('splash-debug', msg)
        splashWindow.webContents.send('splash-debug', `📦 Download URL: ${info.files?.[0]?.url || 'unknown'}`)
    }
    if (myWindow && !myWindow.isDestroyed()) {
        myWindow.webContents.send('update-available', info)
    }
})

autoUpdater.on('update-not-available', (info) => {
    const msg = `❌ No update available. Latest: ${info?.version || 'unknown'}, Current: ${APP_VERSION}`
    console.log(msg)
    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.webContents.send('splash-status', 'No updates available')
        splashWindow.webContents.send('splash-debug', msg)
        splashWindow.webContents.send('splash-debug', `🔗 Feed URL: martimaur/not-ed (GitHub)`)
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
        }, 5000) // Increased from 1 to 5 seconds to see debug info longer
    } else {
        createMainWindow()
    }
})

autoUpdater.on('error', (err) => {
    const msg = `💥 Auto-updater error: ${err.message || err}`
    console.log(msg)
    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.webContents.send('splash-status', 'Starting application...')
        splashWindow.webContents.send('splash-debug', msg)
        splashWindow.webContents.send('splash-debug', `🔧 Stack: ${err.stack?.substring(0, 100) || 'no stack'}`)
        setTimeout(() => {
            createMainWindow()
            if (splashWindow && !splashWindow.isDestroyed()) {
                splashWindow.webContents.send('splash-close')
            }
        }, 5000) // Increased from 1 to 5 seconds to see error info longer
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
            autoUpdater.quitAndInstall()
        }, 2000)
    }
    if (myWindow && !myWindow.isDestroyed()) {
        myWindow.webContents.send('update-downloaded', info)
    }
})

// Paths to store data
const tasksFilePath = path.join(__dirname, 'tasks.json')
const tabsFilePath = path.join(__dirname, 'tabs.json')

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

    // IPC handler for debug update check
    ipcMain.handle('debug-fetch-releases', async () => {
        try {
            const https = require('https');
            const url = 'https://api.github.com/repos/martimaur/not-ed/releases/latest';
            
            return new Promise((resolve, reject) => {
                const req = https.get(url, {
                    headers: {
                        'User-Agent': 'not-ed-debug'
                    }
                }, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        try {
                            const release = JSON.parse(data);
                            resolve({
                                success: true,
                                currentVersion: APP_VERSION,
                                latestVersion: release.tag_name,
                                publishedAt: release.published_at,
                                assetsCount: release.assets.length,
                                isDev: isDev,
                                isPackaged: app.isPackaged
                            });
                        } catch (e) {
                            resolve({ error: 'Failed to parse response: ' + e.message, rawData: data });
                        }
                    });
                });
                
                req.on('error', (err) => {
                    resolve({ error: 'Network error: ' + err.message });
                });
                
                req.setTimeout(10000, () => {
                    req.destroy();
                    resolve({ error: 'Request timeout' });
                });
            });
        } catch (error) {
            return { error: 'Debug fetch error: ' + error.message };
        }
    });

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
        autoUpdater.quitAndInstall()
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
        
        // Send initial debug info to splash window
        if (splashWindow && !splashWindow.isDestroyed()) {
            splashWindow.webContents.send('splash-debug', `Environment: ${isDev ? 'Development' : 'Production'}`)
            splashWindow.webContents.send('splash-debug', `Current version: ${APP_VERSION}`)
            splashWindow.webContents.send('splash-debug', `Auto-updater: ${!isDev ? 'Enabled' : 'Disabled'}`)
            splashWindow.webContents.send('splash-debug', `app.isPackaged: ${app.isPackaged}`)
            splashWindow.webContents.send('splash-debug', `NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`)
        }
        
        if (!isDev) {
            startUpdateProcess();
        } else {
            // In development, skip update check and go straight to main app
            splashWindow.webContents.send('splash-status', 'Development mode - Starting application...');
            splashWindow.webContents.send('splash-debug', 'Development mode - skipping update check');
            setTimeout(() => {
                createMainWindow();
                splashWindow.webContents.send('splash-close');
            }, 10000); // 10 seconds instead of 2
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
    console.log('Starting update process...')
    console.log('- isDev:', isDev)
    console.log('- Current version:', APP_VERSION)
    console.log('- Auto-updater enabled:', !isDev)
    
    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.webContents.send('splash-status', 'Checking for updates...')
        splashWindow.webContents.send('splash-debug', `Environment: ${isDev ? 'Development' : 'Production'}`)
        splashWindow.webContents.send('splash-debug', `Current version: ${APP_VERSION}`)
        splashWindow.webContents.send('splash-debug', `Auto-updater: ${!isDev ? 'Enabled' : 'Disabled'}`)
        splashWindow.webContents.send('splash-debug', `app.isPackaged: ${app.isPackaged}`)
        splashWindow.webContents.send('splash-debug', `NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`)
    }
    
    if (!isDev) {
        // Start checking for updates
        setTimeout(() => {
            console.log('Calling autoUpdater.checkForUpdatesAndNotify()...')
            if (splashWindow && !splashWindow.isDestroyed()) {
                splashWindow.webContents.send('splash-debug', 'Calling autoUpdater.checkForUpdatesAndNotify()...')
            }
            autoUpdater.checkForUpdatesAndNotify()
        }, 1000)

        // If no update found after 15 seconds, proceed to main app
        setTimeout(() => {
            if (!updateAvailable && !updateDownloaded && !mainWindowCreated) {
                console.log('Timeout reached - no update found, starting main app')
                if (splashWindow && !splashWindow.isDestroyed()) {
                    splashWindow.webContents.send('splash-status', 'Starting application...')
                    splashWindow.webContents.send('splash-debug', 'Timeout reached - starting main app')
                }
                setTimeout(() => {
                    createMainWindow()
                    if (splashWindow && !splashWindow.isDestroyed()) {
                        splashWindow.webContents.send('splash-close')
                    }
                }, 1000)
            }
        }, 15000) // Increased from 10 to 15 seconds
    } else {
        // In development mode, just show the app after a short delay
        if (splashWindow && !splashWindow.isDestroyed()) {
            splashWindow.webContents.send('splash-debug', 'Development mode - skipping update check')
        }
        setTimeout(() => {
            if (splashWindow && !splashWindow.isDestroyed()) {
                splashWindow.webContents.send('splash-status', 'Starting application...')
            }
            setTimeout(() => {
                createMainWindow()
                if (splashWindow && !splashWindow.isDestroyed()) {
                    splashWindow.webContents.send('splash-close')
                }
            }, 1000)
        }, 2000)
    }
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
