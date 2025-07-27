const { ipcRenderer } = require('electron');

// Window controls
const minimizeBtn = document.getElementById('minimize-btn');
const maximizeBtn = document.getElementById('maximize-btn');
const closeBtn = document.getElementById('close-btn');
const pinBtn = document.getElementById('pin-btn');
const titleBar = document.getElementById('title-bar');

// Window control event listeners
minimizeBtn.addEventListener('click', () => {
    ipcRenderer.send('window-controls', 'minimize');
});

maximizeBtn.addEventListener('click', () => {
    ipcRenderer.send('window-controls', 'maximize');
});

closeBtn.addEventListener('click', () => {
    ipcRenderer.send('window-controls', 'close');
});

pinBtn.addEventListener('click', () => {
    ipcRenderer.send('window-controls', 'toggle-pin');
});

// Listen for pin state updates from main process
ipcRenderer.on('pin-state-changed', (event, isPinned) => {
    const pinIconUnpinned = pinBtn.querySelector('.pin-icon-unpinned');
    const pinIconPinned = pinBtn.querySelector('.pin-icon-pinned');
    
    if (isPinned) {
        pinBtn.classList.add('pinned');
        pinBtn.title = 'Unpin window (disable always on top)';
        pinIconUnpinned.style.display = 'none';
        pinIconPinned.style.display = 'block';
    } else {
        pinBtn.classList.remove('pinned');
        pinBtn.title = 'Pin window to stay on top';
        pinIconUnpinned.style.display = 'block';
        pinIconPinned.style.display = 'none';
    }
});

// Title bar drag functionality with double-click to maximize
let titleBarClickCount = 0;
let titleBarClickTimer = null;

titleBar.addEventListener('mousedown', (e) => {
    // Only trigger on the drag region, not on control buttons
    if (e.target.closest('.title-bar-controls')) return;
    
    titleBarClickCount++;
    
    if (titleBarClickCount === 1) {
        titleBarClickTimer = setTimeout(() => {
            titleBarClickCount = 0;
        }, 300);
    } else if (titleBarClickCount === 2) {
        clearTimeout(titleBarClickTimer);
        titleBarClickCount = 0;
        // Double-click to maximize/restore
        ipcRenderer.send('window-controls', 'maximize');
    }
});

// Task management UI
const taskList = document.querySelector('.task-list');
const addTaskBtn = document.getElementById('add-tab-btn'); // Changed to use tab add button
const quickAddInput = document.getElementById('quick-add-input');

// Edit modal elements
const editModal = document.getElementById('edit-modal');
const editModalContent = editModal.querySelector('.modal-content');
const editInput = document.getElementById('edit-input');
const editDeleteBtn = document.getElementById('edit-delete-btn');
const editCloseBtn = document.getElementById('edit-close-btn');

// Due date elements
const dateInput = document.getElementById('date-input');
const timeDisplay = document.getElementById('time-display');
const timePickerControls = document.getElementById('time-picker-controls');
const hourDisplay = document.getElementById('hour-display');
const minuteDisplay = document.getElementById('minute-display');
const periodDisplay = document.getElementById('period-display');
const hourWheel = document.getElementById('hour-items');
const minuteWheel = document.getElementById('minute-items');
const periodWheel = document.getElementById('period-items');
const timePickerCancel = document.getElementById('time-picker-cancel');
const timePickerOk = document.getElementById('time-picker-ok');
const clearDueBtn = document.getElementById('clear-due-btn');

// Settings modal elements
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const settingsCloseBtn = document.getElementById('settings-close-btn');
const settingsCancelBtn = document.getElementById('settings-cancel-btn');
const settingsSaveBtn = document.getElementById('settings-save-btn');

// Settings controls
const themeRadios = document.querySelectorAll('input[name="theme"]');
const timeFormatRadios = document.querySelectorAll('input[name="timeFormat"]');
const colorOptions = document.querySelectorAll('.color-option');
const workEndHour = document.getElementById('work-end-hour');
const workEndMinute = document.getElementById('work-end-minute');
const workEndPeriod = document.getElementById('work-end-period');

// Settings configuration
let settings = {
    theme: 'dark',
    timeFormat: '12h',
    accentColor: '#7662cf',
    workEndTime: { hour: 11, minute: 55, period: 'PM' }
};

// Current task being edited
let currentEditTask = null;
let originalTaskText = '';
let originalDueDate = null;
let loaded = false;

// Tab management
let currentTabId = null;
let tabs = {};

// Tab elements
const tabContainer = document.querySelector('.tab-container');
// addTabBtn is now the same as addTaskBtn, so we don't need both

// Context menu elements
const contextMenu = document.getElementById('context-menu');
const contextRename = document.getElementById('context-rename');
const contextClear = document.getElementById('context-clear');
const contextDelete = document.getElementById('context-delete');
let contextMenuTarget = null;

// Function to ensure we always have at least one tab
function ensureHomeTabExists() {
    const tabCount = Object.keys(tabs).length;
    console.log(`Current tab count: ${tabCount}`);
    
    if (tabCount === 0) {
        console.log('No tabs exist, creating Home tab');
        const homeId = 'home_' + Date.now();
        tabs[homeId] = { name: 'Home', tasks: [] };
        
        // Create the tab element
        const homeTab = createTab(homeId, 'Home');
        
        // Switch to it
        switchToTab(homeId);
        
        // Auto-focus into renaming
        setTimeout(() => {
            startTabRename(homeTab, homeId);
        }, 50);
        
        // Don't save here - will be saved when app closes
        
        return homeId;
    }
    
    return null;
}

// Tab functionality
function createTab(id, name) {
    const tab = document.createElement('div');
    tab.className = 'tab';
    tab.setAttribute('data-tab-id', id);
    tab.draggable = true; // Make tab draggable
    
    tab.innerHTML = `
        <span class="tab-name">${name}</span>
        <input class="tab-name-input" type="text" style="display: none;" />
    `;
    
    // Insert before the add button
    tabContainer.insertBefore(tab, addTaskBtn);
    
    // Add click event
    tab.addEventListener('click', () => switchToTab(id));
    
    // Add double-click event for renaming
    tab.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        startTabRename(tab, id);
    });
    
    // Add right-click context menu
    tab.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(e, tab, id);
    });
    
    // Add drag and drop events
    tab.addEventListener('dragstart', handleTabDragStart);
    tab.addEventListener('dragover', handleTabDragOver);
    tab.addEventListener('drop', handleTabDrop);
    tab.addEventListener('dragend', handleTabDragEnd);
    
    // Adjust tab sizes after adding new tab
    adjustTabSizes();
    
    return tab;
}

// Function to dynamically adjust tab sizes based on available space
function adjustTabSizes() {
    const tabs = tabContainer.querySelectorAll('.tab');
    const addBtn = tabContainer.querySelector('.tab-add-btn');
    
    if (tabs.length === 0) return;
    
    // Get actual visible width (viewport width) minus add button width and padding
    const viewportWidth = window.innerWidth;
    const addBtnWidth = addBtn ? addBtn.offsetWidth : 32;
    const padding = 60; // Account for container padding, gaps, and margins
    const availableWidth = viewportWidth - addBtnWidth - padding;
    
    // Calculate optimal tab width (matching CSS values)
    const minTabWidth = 20;
    const maxTabWidth = 100;
    const idealTabWidth = 80;
    
    // Calculate width per tab based on available space
    let tabWidth = Math.max(minTabWidth, Math.min(maxTabWidth, availableWidth / tabs.length));
    
    // If tabs would be too small, use minimum width and allow scrolling
    if (tabWidth < minTabWidth) {
        tabWidth = minTabWidth;
    }
    
    // Apply the calculated width to all tabs
    tabs.forEach(tab => {
        tab.style.width = `${tabWidth}px`;
        tab.style.minWidth = `${minTabWidth}px`;
        tab.style.maxWidth = `${maxTabWidth}px`;
    });
}

// Drag and drop variables
let draggedTab = null;

// Drag and drop handlers for tab reordering
function handleTabDragStart(e) {
    draggedTab = e.target;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', draggedTab.outerHTML);
    draggedTab.classList.add('dragging');
}

function handleTabDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    
    const targetTab = e.currentTarget;
    if (targetTab !== draggedTab && targetTab.classList.contains('tab')) {
        // Clear all existing drag indicators from all tabs
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('drop-indicator', 'drop-indicator-left');
        });
        
        const rect = targetTab.getBoundingClientRect();
        const midpoint = rect.left + rect.width / 2;
        
        if (e.clientX < midpoint) {
            // Dropping before this tab
            const prevTab = targetTab.previousElementSibling;
            if (prevTab && prevTab.classList.contains('tab')) {
                // Show indicator on the right of the previous tab
                prevTab.classList.add('drop-indicator');
            } else {
                // First tab - show indicator on the left of current tab
                targetTab.classList.add('drop-indicator-left');
            }
        } else {
            // Dropping after this tab - show indicator on the right of this tab
            targetTab.classList.add('drop-indicator');
        }
    }
    
    return false;
}

function handleTabDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    const targetTab = e.currentTarget;
    if (draggedTab !== targetTab && targetTab.classList.contains('tab')) {
        const rect = targetTab.getBoundingClientRect();
        const midpoint = rect.left + rect.width / 2;
        
        if (e.clientX < midpoint) {
            // Insert before target
            tabContainer.insertBefore(draggedTab, targetTab);
        } else {
            // Insert after target
            tabContainer.insertBefore(draggedTab, targetTab.nextSibling);
        }
        
        // Update tab order in data structure
        updateTabOrder();
    }
    
    return false;
}

function handleTabDragEnd(e) {
    // Clean up drag classes
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('dragging', 'drop-indicator', 'drop-indicator-left');
    });
    draggedTab = null;
}

function updateTabOrder() {
    // Get current DOM order of tabs
    const tabElements = Array.from(tabContainer.querySelectorAll('.tab'));
    const newTabOrder = {};
    
    // Rebuild tabs object in the new order
    tabElements.forEach(tabElement => {
        const tabId = tabElement.getAttribute('data-tab-id');
        if (tabs[tabId]) {
            newTabOrder[tabId] = tabs[tabId];
        }
    });
    
    // Update the tabs object
    tabs = newTabOrder;
    
    console.log('Tab order updated:', Object.keys(tabs));
}

function switchToTab(tabId) {
    // Save current tab's tasks
    saveCurrentTabTasks();
    
    // Update active tab visually
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    const targetTab = document.querySelector(`[data-tab-id="${tabId}"]`);
    if (targetTab) {
        targetTab.classList.add('active');
    }
    
    // Switch to new tab
    currentTabId = tabId;
    loadTabTasks(tabId);
}

function saveCurrentTabTasks() {
    console.log(`Attempting to save tasks for tab: ${currentTabId}`);
    console.log('Current tabs object:', tabs);
    console.log('Tasks in DOM:', taskList.children.length);
    if (tabs[currentTabId]) {
        const tasks = collectTasksAsJSON();
        console.log(`Saving tasks for tab ${currentTabId}:`, tasks);
        tabs[currentTabId].tasks = tasks;
        console.log(`Tasks saved to tab ${currentTabId}. Total tasks: ${tasks.length}`);
    } else {
        console.error(`Tab ${currentTabId} not found in tabs object!`);
        console.log('Available tabs:', Object.keys(tabs));
    }
}

function loadTabTasks(tabId) {
    console.log(`Loading tasks for tab: ${tabId}`);
    taskList.innerHTML = '';
    if (tabs[tabId] && tabs[tabId].tasks) {
        console.log(`Found ${tabs[tabId].tasks.length} tasks for tab ${tabId}`);
        tabs[tabId].tasks.forEach(task => {
            createTaskFromData(task);
        });
        console.log(`Loaded ${tabs[tabId].tasks.length} tasks into DOM`);
    } else {
        console.log(`No tasks found for tab ${tabId} or tab doesn't exist`);
    }
}

function startTabRename(tabElement, tabId) {
    const nameSpan = tabElement.querySelector('.tab-name');
    const nameInput = tabElement.querySelector('.tab-name-input');
    
    nameInput.value = nameSpan.textContent;
    nameSpan.style.display = 'none';
    nameInput.style.display = 'block';
    nameInput.focus();
    nameInput.select();
    
    function finishRename() {
        const newName = nameInput.value.trim();
        if (newName && newName !== nameSpan.textContent) {
            nameSpan.textContent = newName;
            tabs[tabId].name = newName;
            // will be saved when app closes
        }
        nameInput.style.display = 'none';
        nameSpan.style.display = 'block';
        
        // Remove event listeners
        nameInput.removeEventListener('blur', blurHandler);
        nameInput.removeEventListener('keydown', keydownHandler);
    }
    
    function blurHandler() {
        finishRename();
    }
    
    function keydownHandler(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            finishRename();
        } else if (e.key === 'Escape') {
            nameInput.value = nameSpan.textContent;
            finishRename();
        }
    }
    
    nameInput.addEventListener('blur', blurHandler);
    nameInput.addEventListener('keydown', keydownHandler);
}

function addNewTab() {
    const id = 'tab_' + Date.now();
    const defaultName = 'New Tab';
    
    // Create the tab data
    tabs[id] = { name: defaultName, tasks: [] };
    
    // Create the tab element
    const newTab = createTab(id, defaultName);
    
    // Switch to the new tab
    switchToTab(id);
    
    // Immediately start renaming the tab
    startTabRename(newTab, id);
    
    // Don't save here - will be saved when app closes
}

function saveTabs() {
    // Save current tab's tasks before saving all tabs
    saveCurrentTabTasks();
    console.log('Saving tabs to file:', tabs);
    
    // Save to file instead of localStorage
    ipcRenderer.invoke('save-tabs', tabs).then(result => {
        if (result.success) {
            console.log('Tabs saved successfully to file');
        } else {
            console.error('Failed to save tabs:', result.error);
        }
    });
    
    // Also save current tab to localStorage for quick access
    localStorage.setItem('noted-current-tab', currentTabId);
}

async function loadTabs() {
    console.log('Loading tabs from file...');
    
    try {
        // Load tabs from file
        const result = await ipcRenderer.invoke('load-tabs');
        const savedCurrentTab = localStorage.getItem('noted-current-tab');
        
        console.log('File load result:', result);
        console.log('Saved current tab from localStorage:', savedCurrentTab);
        
        if (result.success && result.tabs) {
            tabs = result.tabs;
            
            // Create tab elements for all saved tabs
            Object.keys(tabs).forEach(tabId => {
                createTab(tabId, tabs[tabId].name);
            });
            
            // Switch to the saved current tab if it exists
            if (savedCurrentTab && tabs[savedCurrentTab]) {
                switchToTab(savedCurrentTab);
            } else {
                // Switch to the first available tab
                const tabIds = Object.keys(tabs);
                if (tabIds.length > 0) {
                    switchToTab(tabIds[0]);
                }
            }
        } else {
            // No saved tabs, start fresh
            tabs = {};
            
            // Check if there are old tasks to migrate to home tab
            await migrateOldTasksToHomeTab();
        }
        
        // Ensure we always have at least one tab
        ensureHomeTabExists();
        
        // Adjust tab sizes after all tabs are loaded
        setTimeout(() => adjustTabSizes(), 100);
        
        console.log('Tabs loaded from file:', tabs);
    } catch (error) {
        console.error('Error loading tabs:', error);
        // Fallback to empty tabs
        tabs = {};
        ensureHomeTabExists();
        setTimeout(() => adjustTabSizes(), 100);
    }
}

// Function to migrate old tasks from the file system to a new home tab
async function migrateOldTasksToHomeTab() {
    try {
        const result = await ipcRenderer.invoke('load-tasks');
        if (result.success && result.tasks && result.tasks.length > 0) {
            console.log('Found old tasks to migrate:', result.tasks);
            
            // Create a new home tab with the old tasks
            const homeId = 'home_' + Date.now();
            tabs[homeId] = { name: 'Home', tasks: result.tasks };
            
            console.log('Successfully migrated old tasks to new Home tab');
        }
    } catch (error) {
        console.log('No old tasks to migrate or error during migration:', error);
    }
}

// Context menu functions
function showContextMenu(event, tabElement, tabId) {
    contextMenuTarget = { element: tabElement, id: tabId };
    
    contextMenu.style.display = 'block';
    contextMenu.style.left = event.pageX + 'px';
    contextMenu.style.top = event.pageY + 'px';
    
    // Adjust position if menu goes off screen
    const menuRect = contextMenu.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    if (menuRect.right > windowWidth) {
        contextMenu.style.left = (event.pageX - menuRect.width) + 'px';
    }
    
    if (menuRect.bottom > windowHeight) {
        contextMenu.style.top = (event.pageY - menuRect.height) + 'px';
    }
}

function hideContextMenu() {
    contextMenu.style.display = 'none';
    contextMenuTarget = null;
}

function deleteTab(tabId) {
    // Remove from DOM
    const tabElement = document.querySelector(`[data-tab-id="${tabId}"]`);
    if (tabElement) {
        tabElement.remove();
    }
    
    // Remove from tabs object
    delete tabs[tabId];
    
    // If we're deleting the current tab, we need to switch to another
    if (currentTabId === tabId) {
        // Try to switch to the first available tab
        const remainingTabIds = Object.keys(tabs);
        if (remainingTabIds.length > 0) {
            switchToTab(remainingTabIds[0]);
        } else {
            currentTabId = null;
        }
    }
    
    // Ensure we always have at least one tab (create Home if needed)
    ensureHomeTabExists();
    
    // Adjust tab sizes after deletion
    adjustTabSizes();
    
    // Don't save here - will be saved when app closes
}

function clearTabTasks(tabId) {
    if (tabs[tabId]) {
        tabs[tabId].tasks = [];
        
        // If it's the current tab, also clear the UI
        if (currentTabId === tabId) {
            taskList.innerHTML = '';
        }
        
        // Don't save here - will be saved when app closes
    }
}

// Add tab button event
addTaskBtn.addEventListener('click', addNewTab);

// Context menu event listeners
contextRename.addEventListener('click', () => {
    if (contextMenuTarget) {
        startTabRename(contextMenuTarget.element, contextMenuTarget.id);
        hideContextMenu();
    }
});

contextClear.addEventListener('click', () => {
    if (contextMenuTarget) {
        clearTabTasks(contextMenuTarget.id);
        hideContextMenu();
    }
});

contextDelete.addEventListener('click', () => {
    if (contextMenuTarget) {
        deleteTab(contextMenuTarget.id);
        hideContextMenu();
    }
});

// Hide context menu when clicking elsewhere
document.addEventListener('click', (e) => {
    if (!contextMenu.contains(e.target)) {
        hideContextMenu();
    }
});

// Hide context menu on escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        hideContextMenu();
        
        // Also hide edit modal if it's open
        if (editModal.style.display === 'flex') {
            hideEditModal();
        }
    }
});

// Debounce object to prevent rapid clicks
const toggleDebounce = new Map();


// Function to collect all tasks from the DOM and convert to JSON
function collectTasksAsJSON() {
    const taskElements = taskList.querySelectorAll('.task');
    const tasks = Array.from(taskElements).map((taskDiv, index) => {
        const checkbox = taskDiv.querySelector('.task-checkbox');
        const textSpan = taskDiv.querySelector('.task-text');
        const taskData = {
            id: index + 1,
            text: textSpan.textContent.trim(),
            completed: checkbox.checked,
            order: index
        };
        
        // Add due date if it exists
        if (taskDiv.dataset.dueDate) {
            taskData.dueDate = taskDiv.dataset.dueDate;
        }
        
        return taskData;
    });
    return tasks;
}

// Function to save tasks (saves current tab's tasks to the tab system)
async function saveTasks() {
    // Save tasks to current tab first
    saveCurrentTabTasks();
    
    // Save the entire tab system (which includes all tasks)
    saveTabs();
}

// Function to load tasks on startup
async function loadTasks() {
    // Instead of loading from file, load the current tab's tasks
    loadTabTasks(currentTabId);
    loaded = true;
}

// Helper function to format due date for display
function formatDueDate(dueDateString) {
    if (!dueDateString) return '';
    
    const dueDate = new Date(dueDateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const due = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    
    const diffDays = Math.floor((due - today) / (24 * 60 * 60 * 1000));
    const timeStr = dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (diffDays === 0) {
        return `Today ${timeStr}`;
    } else if (diffDays === 1) {
        return `Tomorrow ${timeStr}`;
    } else if (diffDays === -1) {
        return `Yesterday ${timeStr}`;
    } else if (diffDays > 1 && diffDays <= 7) {
        return `${dueDate.toLocaleDateString([], { weekday: 'short' })} ${timeStr}`;
    } else if (diffDays < -1 && diffDays >= -7) {
        return `${Math.abs(diffDays)} days ago ${timeStr}`;
    } else {
        return `${dueDate.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timeStr}`;
    }
}

// Helper function to get due date status class
function getDueDateClass(dueDateString) {
    if (!dueDateString) return '';
    
    const dueDate = new Date(dueDateString);
    const now = new Date();
    const diffHours = (dueDate - now) / (1000 * 60 * 60);
    
    if (diffHours < 0) {
        return 'overdue';
    } else if (diffHours <= 5) {
        return 'due-today';
    } else if (diffHours <= 48) {
        return 'due-soon';
    }
    return '';
}

// Smart text parsing for deadline detection
function parseSmartDeadline(text) {
    const now = new Date();
    let parsedDate = null;
    let matchedText = '';
    let startIndex = -1;
    let endIndex = -1;
    
    // Convert text to lowercase for matching
    const lowerText = text.toLowerCase();
    
    // Time patterns
    const timePatterns = [
        // 24-hour format: 17h, 15:30, 23h45
        { 
            regex: /\b(\d{1,2})h(\d{2})?\b/g, 
            handler: (match, hour, minute) => ({ hour: parseInt(hour), minute: parseInt(minute || '0') }) 
        },
        // 24-hour with colon: 15:30, 9:45
        { 
            regex: /\b(\d{1,2}):(\d{2})\b/g, 
            handler: (match, hour, minute) => ({ hour: parseInt(hour), minute: parseInt(minute) }) 
        },
        // 12-hour format: 5 PM, 3 AM, 11h55 pm
        { 
            regex: /\b(\d{1,2})(?:h(\d{2}))?\s*(pm|am)\b/g, 
            handler: (match, hour, minute, period) => {
                let h = parseInt(hour);
                if (period === 'pm' && h !== 12) h += 12;
                if (period === 'am' && h === 12) h = 0;
                return { hour: h, minute: parseInt(minute || '0') };
            }
        },
        // Simple hour: "at 5", "at 17"
        { 
            regex: /\bat\s+(\d{1,2})\b/g, 
            handler: (match, hour) => {
                let h = parseInt(hour);
                // If hour is 1-12, assume PM for afternoon/evening times
                if (h >= 1 && h <= 12 && h !== 12) {
                    const currentHour = now.getHours();
                    // If it's currently afternoon/evening, assume PM
                    if (currentHour >= 12) h += 12;
                }
                return { hour: h, minute: 0 };
            }
        }
    ];
    
    // Date patterns
    const datePatterns = [
        // "today", "today morning", "today evening"
        { 
            regex: /\btoday\b(?:\s+(morning|afternoon|evening))?\b/g, 
            handler: (match, timeOfDay) => {
                const date = new Date(now);
                // Use settings for default end of work time
                let workEndHour = settings.workEndTime.hour;
                if (settings.workEndTime.period === 'PM' && workEndHour !== 12) workEndHour += 12;
                if (settings.workEndTime.period === 'AM' && workEndHour === 12) workEndHour = 0;
                
                let defaultTime = { hour: workEndHour, minute: settings.workEndTime.minute };
                
                if (timeOfDay === 'morning') defaultTime = { hour: 9, minute: 0 };
                else if (timeOfDay === 'afternoon') defaultTime = { hour: 14, minute: 0 };
                else if (timeOfDay === 'evening') defaultTime = { hour: 18, minute: 0 };
                
                return { date, defaultTime };
            }
        },
        // "tomorrow", "tomorrow morning", etc.
        { 
            regex: /\btomorrow\b(?:\s+(morning|afternoon|evening))?\b/g, 
            handler: (match, timeOfDay) => {
                const date = new Date(now);
                date.setDate(date.getDate() + 1);
                // Use settings for default end of work time
                let workEndHour = settings.workEndTime.hour;
                if (settings.workEndTime.period === 'PM' && workEndHour !== 12) workEndHour += 12;
                if (settings.workEndTime.period === 'AM' && workEndHour === 12) workEndHour = 0;
                
                let defaultTime = { hour: workEndHour, minute: settings.workEndTime.minute };
                
                if (timeOfDay === 'morning') defaultTime = { hour: 9, minute: 0 };
                else if (timeOfDay === 'afternoon') defaultTime = { hour: 14, minute: 0 };
                else if (timeOfDay === 'evening') defaultTime = { hour: 18, minute: 0 };
                
                return { date, defaultTime };
            }
        }
    ];
    
    let bestMatch = null;
    let bestScore = 0;
    
    // First, look for date patterns
    for (const pattern of datePatterns) {
        const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
        let match;
        
        while ((match = regex.exec(lowerText)) !== null) {
            const result = pattern.handler(match[0], match[1]);
            const score = match[0].length;
            
            if (score > bestScore) {
                bestMatch = {
                    type: 'date',
                    result,
                    match: match[0],
                    start: match.index,
                    end: match.index + match[0].length
                };
                bestScore = score;
            }
        }
    }
    
    // Then look for time patterns
    for (const pattern of timePatterns) {
        const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
        let match;
        
        while ((match = regex.exec(lowerText)) !== null) {
            const result = pattern.handler(match[0], match[1], match[2], match[3]);
            const score = match[0].length;
            
            if (score > bestScore) {
                bestMatch = {
                    type: 'time',
                    result,
                    match: match[0],
                    start: match.index,
                    end: match.index + match[0].length
                };
                bestScore = score;
            }
        }
    }
    
    // Combine date and time if found
    if (bestMatch) {
        if (bestMatch.type === 'date') {
            const { date, defaultTime } = bestMatch.result;
            
            // Look for time patterns near the date
            const timeContext = lowerText.substring(Math.max(0, bestMatch.start - 20), Math.min(lowerText.length, bestMatch.end + 20));
            let timeFound = null;
            
            for (const pattern of timePatterns) {
                const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
                const timeMatch = regex.exec(timeContext);
                if (timeMatch) {
                    timeFound = pattern.handler(timeMatch[0], timeMatch[1], timeMatch[2], timeMatch[3]);
                    break;
                }
            }
            
            const finalTime = timeFound || defaultTime;
            date.setHours(finalTime.hour, finalTime.minute, 0, 0);
            parsedDate = date;
            
        } else if (bestMatch.type === 'time') {
            // Time without explicit date - assume today
            const date = new Date(now);
            const { hour, minute } = bestMatch.result;
            date.setHours(hour, minute, 0, 0);
            
            // If the time is in the past today, assume tomorrow
            if (date < now) {
                date.setDate(date.getDate() + 1);
            }
            
            parsedDate = date;
        }
        
        matchedText = bestMatch.match;
        startIndex = bestMatch.start;
        endIndex = bestMatch.end;
    }
    
    return {
        date: parsedDate,
        matchedText,
        startIndex,
        endIndex,
        hasMatch: !!parsedDate
    };
}

// Function to highlight deadline text in task content
function highlightDeadlineText(text, startIndex, endIndex) {
    if (startIndex === -1 || endIndex === -1) return text;
    
    const before = text.substring(0, startIndex);
    const highlighted = text.substring(startIndex, endIndex);
    const after = text.substring(endIndex);
    
    return before + '<span class="deadline-highlight">' + highlighted + '</span>' + after;
}

// Settings management functions
function loadSettings() {
    try {
        const savedSettings = localStorage.getItem('noted-settings');
        if (savedSettings) {
            settings = { ...settings, ...JSON.parse(savedSettings) };
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
    applySettings();
}

function saveSettings() {
    try {
        localStorage.setItem('noted-settings', JSON.stringify(settings));
        applySettings();
    } catch (error) {
        console.error('Error saving settings:', error);
    }
}

function applySettings() {
    // Apply theme
    document.body.setAttribute('data-theme', settings.theme);
    
    // Apply accent color
    document.documentElement.style.setProperty('--accent-color', settings.accentColor);
    
    // Update time displays if needed (this could be expanded later)
    updateAllTimestamps();
}

function updateAllTimestamps() {
    // Re-format all due date displays according to current settings
    document.querySelectorAll('.task-due-date').forEach(dueDateSpan => {
        const taskDiv = dueDateSpan.closest('.task');
        if (taskDiv && taskDiv.dataset.dueDate) {
            dueDateSpan.textContent = formatDueDate(taskDiv.dataset.dueDate);
        }
    });
}

function showSettingsModal() {
    // Initialize settings UI with current values
    initializeSettingsUI();
    settingsModal.style.display = 'flex';
}

function hideSettingsModal() {
    settingsModal.style.display = 'none';
}

function initializeSettingsUI() {
    // Set theme radio
    const themeRadio = document.querySelector(`input[name="theme"][value="${settings.theme}"]`);
    if (themeRadio) themeRadio.checked = true;
    
    // Set time format radio
    const timeFormatRadio = document.querySelector(`input[name="timeFormat"][value="${settings.timeFormat}"]`);
    if (timeFormatRadio) timeFormatRadio.checked = true;
    
    // Set accent color
    colorOptions.forEach(option => {
        option.classList.remove('selected');
        if (option.dataset.color === settings.accentColor) {
            option.classList.add('selected');
        }
    });
    
    // Set work end time
    populateWorkTimeSelects();
    workEndHour.value = settings.workEndTime.hour;
    workEndMinute.value = settings.workEndTime.minute;
    workEndPeriod.value = settings.workEndTime.period;
}

function populateWorkTimeSelects() {
    // Populate hour options
    workEndHour.innerHTML = '';
    for (let i = 1; i <= 12; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i.toString();
        workEndHour.appendChild(option);
    }
}

function collectSettingsFromUI() {
    const newSettings = { ...settings };
    
    // Get theme
    const selectedTheme = document.querySelector('input[name="theme"]:checked');
    if (selectedTheme) newSettings.theme = selectedTheme.value;
    
    // Get time format
    const selectedTimeFormat = document.querySelector('input[name="timeFormat"]:checked');
    if (selectedTimeFormat) newSettings.timeFormat = selectedTimeFormat.value;
    
    // Get accent color
    const selectedColor = document.querySelector('.color-option.selected');
    if (selectedColor) newSettings.accentColor = selectedColor.dataset.color;
    
    // Get work end time
    newSettings.workEndTime = {
        hour: parseInt(workEndHour.value),
        minute: parseInt(workEndMinute.value),
        period: workEndPeriod.value
    };
    
    return newSettings;
}

// Function to create a task element from saved data
function createTaskFromData(taskData) {
    const taskDiv = document.createElement('div');
    taskDiv.className = 'task';
    taskDiv.dataset.taskId = taskData.id || Date.now() + Math.random();
    
    // Store due date in dataset if it exists
    if (taskData.dueDate) {
        taskDiv.dataset.dueDate = taskData.dueDate;
    }
    
    // Add completed class if task was completed (static, no animation on load)
    if (taskData.completed) {
        taskDiv.classList.add('completed-static');
    }

    // checkbox first
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'task-checkbox';
    checkbox.checked = taskData.completed;
    checkbox.title = 'Mark completed';
    taskDiv.appendChild(checkbox);

    // Create task content container
    const taskContent = document.createElement('div');
    taskContent.className = 'task-content';
    
    // text in content container
    const span = document.createElement('span');
    span.className = 'task-text';
    
    // Apply highlighting for deadline text when loading
    const parseResult = parseSmartDeadline(taskData.text);
    if (parseResult.hasMatch) {
        span.innerHTML = highlightDeadlineText(taskData.text, parseResult.startIndex, parseResult.endIndex);
    } else {
        span.textContent = taskData.text;
    }
    
    taskContent.appendChild(span);
    
    // Add due date display if exists
    if (taskData.dueDate) {
        const dueDateSpan = document.createElement('span');
        dueDateSpan.className = 'task-due-date';
        dueDateSpan.textContent = formatDueDate(taskData.dueDate);
        
        // Add status classes based on due date
        const dueClass = getDueDateClass(taskData.dueDate);
        if (dueClass) {
            dueDateSpan.classList.add(dueClass);
        }
        
        // Add completed class if task is completed
        if (taskData.completed) {
            dueDateSpan.classList.add('completed');
        }
        
        taskContent.appendChild(dueDateSpan);
    }
    
    taskDiv.appendChild(taskContent);

    // edit button third
    const editBtn = document.createElement('button');
    editBtn.className = 'task-edit-btn';
    editBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/></svg>';
    editBtn.title = 'Edit task';
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showEditModal(taskDiv, span);
    });
    taskDiv.appendChild(editBtn);

    // Add click listener to the entire task div to toggle checkbox
    taskDiv.addEventListener('click', (e) => {
        if (e.target === checkbox || e.target === editBtn || editBtn.contains(e.target)) {
            return;
        }
        checkbox.checked = !checkbox.checked;
        toggleTaskCompletion(taskDiv, checkbox);
    });

    // Add listener to checkbox for direct clicks
    checkbox.addEventListener('change', (e) => {
        toggleTaskCompletion(taskDiv, checkbox);
    });

    taskList.appendChild(taskDiv);
}

// Listen for save request from main process
ipcRenderer.on('request-data-for-save', () => {
    // Save both tasks and tabs
    saveTasks();
    saveTabs();
});

// Function to add a new task
function doAddTask() {
    const taskText = quickAddInput.value.trim();
    if (taskText && taskText.trim() !== '') {
        // Parse for smart deadlines
        const parseResult = parseSmartDeadline(taskText);
        
        const taskDiv = document.createElement('div');
        taskDiv.className = 'task';
        taskDiv.dataset.taskId = Date.now() + Math.random();

        // checkbox first
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'task-checkbox';
        checkbox.title = 'Mark completed';
        taskDiv.appendChild(checkbox);

        // text second
        const taskContent = document.createElement('div');
        taskContent.className = 'task-content';
        
        const span = document.createElement('span');
        span.className = 'task-text';
        
        // Apply highlighting if deadline was found
        if (parseResult.hasMatch) {
            span.innerHTML = highlightDeadlineText(taskText, parseResult.startIndex, parseResult.endIndex);
        } else {
            span.textContent = taskText;
        }
        
        taskContent.appendChild(span);
        
        // Add due date display if parsed
        if (parseResult.date) {
            const dueDateSpan = document.createElement('span');
            dueDateSpan.className = 'task-due-date';
            dueDateSpan.textContent = formatDueDate(parseResult.date.toISOString());
            
            // Add status classes based on due date
            const dueClass = getDueDateClass(parseResult.date.toISOString());
            if (dueClass) {
                dueDateSpan.classList.add(dueClass);
            }
            
            taskContent.appendChild(dueDateSpan);
        }
        
        taskDiv.appendChild(taskContent);

        // Store parsed due date in dataset
        if (parseResult.date) {
            taskDiv.dataset.dueDate = parseResult.date.toISOString();
        }

        // edit button third
        const editBtn = document.createElement('button');
        editBtn.className = 'task-edit-btn';
        editBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/></svg>';
        editBtn.title = 'Edit task';
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent task click from triggering
            showEditModal(taskDiv, span);
        });
        taskDiv.appendChild(editBtn);

        // Add click listener to the entire task div to toggle checkbox
        taskDiv.addEventListener('click', (e) => {
            // Don't toggle if clicking on the checkbox itself or edit button
            if (e.target === checkbox || e.target === editBtn || editBtn.contains(e.target)) {
                return;
            }
            checkbox.checked = !checkbox.checked;
            toggleTaskCompletion(taskDiv, checkbox);
        });

        // Add listener to checkbox for direct clicks
        checkbox.addEventListener('change', (e) => {
            toggleTaskCompletion(taskDiv, checkbox);
        });

        taskList.appendChild(taskDiv);
        quickAddInput.value = '';
        
        // Tasks will be saved when app closes
    }
}

// Load tasks when the app starts
document.addEventListener('DOMContentLoaded', async () => {   
    console.log('DOM loaded, loading tabs...');
    await loadTabs(); // Load tabs first (now async)
    console.log('Tabs loaded, current tabs:', tabs);
    console.log('Current tab ID:', currentTabId);
    
    // The loadTabs function will handle tab switching and ensuring we have tabs
    
    console.log('Tasks loaded, initializing Sortable...');
    Sortable.create(taskList, {
        animation: 240,
        ghostClass: 'sortable-ghost'
    });
    
    // Initialize Lucide icons
    lucide.createIcons();
    
    // Load settings and initialize settings UI
    loadSettings();
    applySettings();
    populateWorkTimeSelects();
    
    // Settings modal event listeners
    settingsBtn.addEventListener('click', () => {
        initializeSettingsUI();
        settingsModal.style.display = 'flex';
    });
    
    settingsCloseBtn.addEventListener('click', () => {
        settingsModal.style.display = 'none';
    });
    
    settingsCancelBtn.addEventListener('click', () => {
        settingsModal.style.display = 'none';
    });
    
    settingsSaveBtn.addEventListener('click', () => {
        settings = { ...settings, ...collectSettingsFromUI() };
        saveSettings();
        applySettings();
        settingsModal.style.display = 'none';
    });
    
    // Close modal when clicking outside
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.style.display = 'none';
        }
    });
    
    // Color picker handling
    colorOptions.forEach(option => {
        option.addEventListener('click', () => {
            colorOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
        });
    });
    
    // Give a bit more time for everything to render
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('Sending renderer-ready signal...');
    // Tell main process that we're ready to show the window
    ipcRenderer.send('renderer-ready');
});

// Add window resize listener to adjust tab sizes
window.addEventListener('resize', () => {
    adjustTabSizes();
});

// Add horizontal scrolling support for tab container
tabContainer.addEventListener('wheel', (e) => {
    // Prevent default vertical scrolling
    e.preventDefault();
    
    // Calculate scroll amount with smoother sensitivity
    const scrollAmount = e.deltaY * 3
    
    // Apply smooth horizontal scroll
    tabContainer.scrollTo({
        left: tabContainer.scrollLeft + scrollAmount,
        behavior: 'smooth'
    });
}, { passive: false });

// Quick add input functionality
quickAddInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        doAddTask();
    }
});

// Modal buttons
editDeleteBtn.title = 'Delete task';
editCloseBtn.title = 'Close';

// Edit modal event listeners
editDeleteBtn.addEventListener('click', deleteTask);
editCloseBtn.addEventListener('click', hideEditModal);

// Auto-resize textarea as user types
editInput.addEventListener('input', () => {
    autoResizeTextarea(editInput);
    checkForChanges();
});

// Time picker variables
let selectedHour = 12;
let selectedMinute = 0;
let selectedPeriod = 'PM';
let isTimePickerOpen = false;

// Variables to store previous values for cancel functionality
let previousSelectedHour = 12;
let previousSelectedMinute = 0;
let previousSelectedPeriod = 'PM';
let previousDateValue = '';
let taskHasDateSet = false;

// Initialize time picker wheels
function initializeTimePickerWheels() {
    // Hours (1-12)
    hourWheel.innerHTML = '';
    for (let i = 1; i <= 12; i++) {
        const item = document.createElement('div');
        item.className = 'wheel-item';
        item.dataset.value = i;
        item.textContent = i.toString().padStart(2, '0');
        item.addEventListener('click', () => selectHour(i));
        hourWheel.appendChild(item);
    }
    
    // Minutes (0-59, step 5)
    minuteWheel.innerHTML = '';
    for (let i = 0; i < 60; i += 5) {
        const item = document.createElement('div');
        item.className = 'wheel-item';
        item.dataset.value = i;
        item.textContent = i.toString().padStart(2, '0');
        item.addEventListener('click', () => selectMinute(i));
        minuteWheel.appendChild(item);
    }
    
    // Period items already in HTML, just add event listeners
    periodWheel.querySelectorAll('.wheel-item').forEach(item => {
        item.addEventListener('click', () => selectPeriod(item.dataset.value));
    });
}

function selectHour(hour) {
    selectedHour = hour;
    updateWheelSelection(hourWheel, hour);
    updateTimeDisplay();
}

function selectMinute(minute) {
    selectedMinute = minute;
    updateWheelSelection(minuteWheel, minute);
    updateTimeDisplay();
}

function selectPeriod(period) {
    selectedPeriod = period;
    updateWheelSelection(periodWheel, period);
    updateTimeDisplay();
}

function updateWheelSelection(wheel, value) {
    wheel.querySelectorAll('.wheel-item').forEach(item => {
        item.classList.remove('selected');
        if (item.dataset.value == value) {
            item.classList.add('selected');
            item.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    });
}

function updateTimeDisplay() {
    hourDisplay.textContent = selectedHour.toString().padStart(2, '0');
    minuteDisplay.textContent = selectedMinute.toString().padStart(2, '0');
    periodDisplay.textContent = selectedPeriod;
}

function setTimeFromDate(date) {
    if (!date) {
        selectedHour = 12;
        selectedMinute = 0;
        selectedPeriod = 'PM';
    } else {
        const hours = date.getHours();
        let minutes = Math.round(date.getMinutes() / 5) * 5; // Round to nearest 5 minutes
        
        // Handle minute overflow (when rounding gives us 60 minutes)
        let adjustedHours = hours;
        if (minutes >= 60) {
            minutes = 0;
            adjustedHours = hours + 1;
        }
        
        selectedHour = adjustedHours === 0 ? 12 : adjustedHours > 12 ? adjustedHours - 12 : adjustedHours;
        selectedMinute = minutes;
        selectedPeriod = adjustedHours >= 12 ? 'PM' : 'AM';
    }
    updateTimeDisplay();
    updateWheelSelection(hourWheel, selectedHour);
    updateWheelSelection(minuteWheel, selectedMinute);
    updateWheelSelection(periodWheel, selectedPeriod);
}

function getSelectedDateTime() {
    const dateValue = dateInput.value;
    if (!dateValue) return null;
    
    const date = new Date(dateValue);
    let hours = selectedHour;
    if (selectedPeriod === 'PM' && hours !== 12) hours += 12;
    if (selectedPeriod === 'AM' && hours === 12) hours = 0;
    
    date.setHours(hours, selectedMinute, 0, 0);
    return date;
}

// Time picker event listeners
timeDisplay.addEventListener('click', () => {
    if (isTimePickerOpen) {
        closeTimePicker();
    } else {
        openTimePicker();
    }
});

function openTimePicker() {
    // Store previous values for cancel functionality
    previousSelectedHour = selectedHour;
    previousSelectedMinute = selectedMinute;
    previousSelectedPeriod = selectedPeriod;
    previousDateValue = dateInput.value;
    
    isTimePickerOpen = true;
    timeDisplay.classList.add('active');
    timePickerControls.style.display = 'block';
    // Set initial selections
    updateWheelSelection(hourWheel, selectedHour);
    updateWheelSelection(minuteWheel, selectedMinute);
    updateWheelSelection(periodWheel, selectedPeriod);
}

function closeTimePicker() {
    isTimePickerOpen = false;
    timeDisplay.classList.remove('active');
    timePickerControls.style.display = 'none';
}

timePickerCancel.addEventListener('click', () => {
    // Restore previous values
    selectedHour = previousSelectedHour;
    selectedMinute = previousSelectedMinute;
    selectedPeriod = previousSelectedPeriod;
    dateInput.value = previousDateValue;
    updateTimeDisplay();
    closeTimePicker();
});

timePickerOk.addEventListener('click', () => {
    taskHasDateSet = true; // Mark that user has set a date/time
    closeTimePicker();
    checkForChanges();
});

// Date input change listener
dateInput.addEventListener('change', () => {
    taskHasDateSet = true; // Mark that user has set a date
    checkForChanges();
});

// Date input focus listener - set default date/time when user first interacts
dateInput.addEventListener('focus', () => {
    // Only set default if date is currently empty
    if (!dateInput.value && !taskHasDateSet) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        dateInput.value = `${year}-${month}-${day}`;
        setTimeFromDate(now);
        taskHasDateSet = true;
        checkForChanges();
    }
});

// Time display click listener - set default date/time when user first interacts with time
const originalTimeDisplayClick = timeDisplay.onclick;
timeDisplay.addEventListener('click', () => {
    // Only set default date if date is currently empty
    if (!dateInput.value && !taskHasDateSet) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        dateInput.value = `${year}-${month}-${day}`;
        setTimeFromDate(now);
        taskHasDateSet = true;
        checkForChanges();
    }
});

// Clear due date button
clearDueBtn.addEventListener('click', () => {
    dateInput.value = '';
    setTimeFromDate(null);
    taskHasDateSet = false; // Reset flag when clearing
    checkForChanges();
});

// Close time picker when clicking outside
document.addEventListener('click', (e) => {
    if (isTimePickerOpen && !e.target.closest('.time-picker')) {
        closeTimePicker();
    }
});

// Initialize time picker on load
initializeTimePickerWheels();
setTimeFromDate(null);

// Variables to track mouse events for safer modal closing
let mouseDownOutside = false;

// Close modal when clicking outside (safer implementation)
editModal.addEventListener('mousedown', (e) => {
    if (e.target === editModal) {
        mouseDownOutside = true;
    } else {
        mouseDownOutside = false;
    }
});

editModal.addEventListener('mouseup', (e) => {
    if (e.target === editModal && mouseDownOutside) {
        hideEditModal();
    }
    mouseDownOutside = false;
});

// Allow Enter key to submit
document.addEventListener('keydown', (e) => {
    // Don't interfere with input elements
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
    }
    
    switch (e.key) {
        case 'Enter':
            if (editModal.style.display === 'flex') {
                hideEditModal(); // Auto-save and close
            }
            break;
        case 'Escape':
            if (editModal.style.display === 'flex') {
                hideEditModal(); // Auto-save and close
            }
            break;
    }
});

// Edit modal functions
function showEditModal(taskDiv, taskTextSpan) {
    currentEditTask = { taskDiv, taskTextSpan };
    originalTaskText = taskTextSpan.textContent;
    originalDueDate = taskDiv.dataset.dueDate || null;
    
    editInput.value = originalTaskText;
    
    // Set due date and time
    if (originalDueDate) {
        taskHasDateSet = true;
        const dueDate = new Date(originalDueDate);
        const year = dueDate.getFullYear();
        const month = String(dueDate.getMonth() + 1).padStart(2, '0');
        const day = String(dueDate.getDate()).padStart(2, '0');
        dateInput.value = `${year}-${month}-${day}`;
        setTimeFromDate(dueDate);
    } else {
        taskHasDateSet = false;
        // Don't set any default date/time - leave fields empty
        dateInput.value = '';
        setTimeFromDate(null);
    }
    
    editModal.style.display = 'flex';
    editInput.focus();
    autoResizeTextarea(editInput);
    checkForChanges();
}

function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.max(50, textarea.scrollHeight) + 'px';
}

function checkForChanges() {
    const currentText = editInput.value.trim();
    const originalText = originalTaskText.trim();
    
    // Get current due date only if user has set one
    const currentDueDate = taskHasDateSet ? getSelectedDateTime() : null;
    const currentDueDateString = currentDueDate ? currentDueDate.toISOString() : null;
    
    // Check if there's a text change or due date change
    const textChanged = currentText !== originalText;
    // Only consider due date changed if user has actively set a date and it differs from original
    const dueDateChanged = taskHasDateSet && (currentDueDateString !== originalDueDate);
    
    if (textChanged || dueDateChanged) {
        // Only show as modified if current text is not empty (has meaningful content)
        if (currentText !== '') {
            editModalContent.classList.add('modified');
        } else {
            editModalContent.classList.remove('modified');
        }
    } else {
        editModalContent.classList.remove('modified');
    }
}

function updateTaskDueDateDisplay(taskDiv, dueDate) {
    const taskContent = taskDiv.querySelector('.task-content');
    let dueDateSpan = taskContent.querySelector('.task-due-date');
    
    if (dueDate) {
        if (!dueDateSpan) {
            dueDateSpan = document.createElement('span');
            dueDateSpan.className = 'task-due-date';
            taskContent.appendChild(dueDateSpan);
        }
        
        dueDateSpan.textContent = formatDueDate(dueDate.toISOString());
        
        // Update status classes
        dueDateSpan.className = 'task-due-date';
        const dueClass = getDueDateClass(dueDate.toISOString());
        if (dueClass) {
            dueDateSpan.classList.add(dueClass);
        }
        
        // Add completed class if task is completed
        if (taskDiv.classList.contains('completed') || taskDiv.classList.contains('completed-static')) {
            dueDateSpan.classList.add('completed');
        }
    } else {
        if (dueDateSpan) {
            dueDateSpan.remove();
        }
    }
}

function hideEditModal() {
    // Auto-save when closing
    if (currentEditTask) {
        const newText = editInput.value.trim();
        const newDueDate = taskHasDateSet ? getSelectedDateTime() : null;
        
        if (newText) {
            // Apply smart parsing to the new text if no due date is currently set
            let finalDueDate = newDueDate;
            if (!taskHasDateSet && !originalDueDate) {
                const parseResult = parseSmartDeadline(newText);
                if (parseResult.hasMatch) {
                    finalDueDate = parseResult.date;
                    // Update the text content with highlighting
                    currentEditTask.taskTextSpan.innerHTML = highlightDeadlineText(newText, parseResult.startIndex, parseResult.endIndex);
                } else {
                    currentEditTask.taskTextSpan.textContent = newText;
                }
            } else {
                // Re-apply highlighting if there's a due date
                if (originalDueDate || taskHasDateSet) {
                    const parseResult = parseSmartDeadline(newText);
                    if (parseResult.hasMatch) {
                        currentEditTask.taskTextSpan.innerHTML = highlightDeadlineText(newText, parseResult.startIndex, parseResult.endIndex);
                    } else {
                        currentEditTask.taskTextSpan.textContent = newText;
                    }
                } else {
                    currentEditTask.taskTextSpan.textContent = newText;
                }
            }
            
            // Check if date/time has been modified from original state
            const finalDueDateString = finalDueDate ? finalDueDate.toISOString() : null;
            const dateWasModified = finalDueDateString !== originalDueDate;
            
            // Update due date if it was originally set, user has made changes, or smart parsing found a date
            if (taskHasDateSet || dateWasModified || finalDueDate) {
                if (finalDueDate) {
                    currentEditTask.taskDiv.dataset.dueDate = finalDueDate.toISOString();
                } else {
                    delete currentEditTask.taskDiv.dataset.dueDate;
                }
                
                // Update due date display in task
                updateTaskDueDateDisplay(currentEditTask.taskDiv, finalDueDate);
            }
            
            // Tasks will be saved when app closes
        }
    }
    
    // Close time picker if open
    if (isTimePickerOpen) {
        closeTimePicker();
    }
    
    editModal.style.display = 'none';
    editModalContent.classList.remove('modified');
    currentEditTask = null;
    originalTaskText = '';
    originalDueDate = null;
    taskHasDateSet = false;
}

function deleteTask() {
    if (currentEditTask) {
        currentEditTask.taskDiv.remove();
        // Tasks will be saved when app closes
        editModal.style.display = 'none';
        editModalContent.classList.remove('modified');
        currentEditTask = null;
        originalTaskText = '';
        originalDueDate = null;
        taskHasDateSet = false;
    }
}

function toggleTaskCompletion(taskDiv, checkbox) {
    // Get unique ID for this task div
    const taskId = taskDiv.dataset.taskId || taskDiv.outerHTML;
    
    // Clear any existing timeout for this task
    if (toggleDebounce.has(taskId)) {
        clearTimeout(toggleDebounce.get(taskId));
    }
    
    // Always sync visual state with checkbox state immediately
    taskDiv.classList.remove('completed', 'completed-static', 'completing');
    
    // Update due date display immediately for visual feedback
    const dueDateSpan = taskDiv.querySelector('.task-due-date');
    if (dueDateSpan) {
        if (checkbox.checked) {
            dueDateSpan.classList.add('completed');
        } else {
            dueDateSpan.classList.remove('completed');
        }
    }
    
    if (checkbox.checked) {
        // Start the completion animation sequence
        taskDiv.classList.add('completing');
        
        // Set timeout for the completion animation
        const timeoutId = setTimeout(() => {
            // Double-check the checkbox state before applying final styling
            if (checkbox.checked) {
                taskDiv.classList.remove('completing');
                taskDiv.classList.add('completed');
                
                // Ensure due date display is updated after animation
                const dueDateSpan = taskDiv.querySelector('.task-due-date');
                if (dueDateSpan) {
                    dueDateSpan.classList.add('completed');
                }
            }
            toggleDebounce.delete(taskId);
        }, 300);
        
        toggleDebounce.set(taskId, timeoutId);
    }
    
    // Tasks will be saved when app closes
}
