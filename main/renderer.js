const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
    // Window control buttons
    document.getElementById('minimize-btn').addEventListener('click', () => {
        ipcRenderer.send('window-controls', 'minimize');
    });

    document.getElementById('maximize-btn').addEventListener('click', () => {
        ipcRenderer.send('window-controls', 'maximize');
    });

    document.getElementById('close-btn').addEventListener('click', () => {
        ipcRenderer.send('window-controls', 'close');
    });

    // Add your other app functionality here
});