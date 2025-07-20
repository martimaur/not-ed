const { ipcRenderer } = require('electron');

// Window controls
const minimizeBtn = document.getElementById('minimize-btn');
const maximizeBtn = document.getElementById('maximize-btn');
const closeBtn = document.getElementById('close-btn');
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

// Current task being edited
let currentEditTask = null;
let originalTaskText = '';
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
    
    return tab;
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
        
        console.log('Tabs loaded from file:', tabs);
    } catch (error) {
        console.error('Error loading tabs:', error);
        // Fallback to empty tabs
        tabs = {};
        ensureHomeTabExists();
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
        return {
            id: index + 1,
            text: textSpan.textContent.trim(),
            completed: checkbox.checked,
            order: index
        };
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

// Function to create a task element from saved data
function createTaskFromData(taskData) {
    const taskDiv = document.createElement('div');
    taskDiv.className = 'task';
    taskDiv.dataset.taskId = taskData.id || Date.now() + Math.random();
    
    // Add completed class if task was completed
    if (taskData.completed) {
        taskDiv.classList.add('completed');
    }

    // checkbox first
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'task-checkbox';
    checkbox.checked = taskData.completed;
    checkbox.title = 'Mark completed';
    taskDiv.appendChild(checkbox);

    // text second
    const span = document.createElement('span');
    span.className = 'task-text';
    span.textContent = taskData.text;
    taskDiv.appendChild(span);

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
        const span = document.createElement('span');
        span.className = 'task-text';
        span.textContent = taskText;
        taskDiv.appendChild(span);

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
    
    // Give a bit more time for everything to render
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('Sending renderer-ready signal...');
    // Tell main process that we're ready to show the window
    ipcRenderer.send('renderer-ready');
});

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

// Initialize Lucide icons
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
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
    editInput.value = originalTaskText;
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
    
    // Check if there's actually a change
    if (currentText !== originalText) {
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

function hideEditModal() {
    // Auto-save when closing
    if (currentEditTask) {
        const newText = editInput.value.trim();
        if (newText) {
            currentEditTask.taskTextSpan.textContent = newText;
            // Tasks will be saved when app closes
        }
    }
    editModal.style.display = 'none';
    editModalContent.classList.remove('modified');
    currentEditTask = null;
    originalTaskText = '';
}

function deleteTask() {
    if (currentEditTask) {
        currentEditTask.taskDiv.remove();
        // Tasks will be saved when app closes
        editModal.style.display = 'none';
        editModalContent.classList.remove('modified');
        currentEditTask = null;
        originalTaskText = '';
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
    taskDiv.classList.remove('completed', 'completing');
    
    if (checkbox.checked) {
        // Start the completion animation sequence
        taskDiv.classList.add('completing');
        
        // Set timeout for the completion animation
        const timeoutId = setTimeout(() => {
            // Double-check the checkbox state before applying final styling
            if (checkbox.checked) {
                taskDiv.classList.remove('completing');
                taskDiv.classList.add('completed');
            }
            toggleDebounce.delete(taskId);
        }, 300);
        
        toggleDebounce.set(taskId, timeoutId);
    }
    
    // Tasks will be saved when app closes
}
