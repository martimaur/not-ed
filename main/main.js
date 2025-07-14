const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')

try {
  require('electron-reloader')(module)
} catch (_) {}

// Path to store tasks data
const tasksFilePath = path.join(__dirname, 'tasks.json')

let myWindow;

app.whenReady().then(() => {
    myWindow = new BrowserWindow({
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
        minHeight: 600,
        show: false, // Don't show window until ready
        backgroundColor: '#1e1e1e' // Match your dark theme
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

    // Handle window close event to save tasks
    myWindow.on('close', async (event) => {
        // Prevent immediate close
        event.preventDefault();
        
        // Request tasks from renderer and save them
        try {
            myWindow.webContents.send('request-tasks-for-save');
            
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

    myWindow.loadFile('index.html');
    
    // Show window when ready to prevent white flash
    myWindow.once('ready-to-show', () => {
        myWindow.show();
    });
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
})
