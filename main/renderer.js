const { ipcRenderer } = require('electron');
// Task management UI
const taskList = document.querySelector('.task-list');
const addTaskBtn = document.getElementById('add-task-btn');
const taskModal = document.getElementById('task-modal');
const taskInput = document.getElementById('task-input');
const taskSubmitBtn = document.getElementById('task-submit-btn');
const taskCancelBtn = document.getElementById('task-cancel-btn');

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

// Function to save tasks (only saves, doesn't reload)
async function saveTasks() {
    const tasks = collectTasksAsJSON();
    try {
        const result = await ipcRenderer.invoke('save-tasks', tasks);
        if (result.success) {
            console.log('Tasks saved successfully');
        } else {
            console.error('Failed to save tasks:', result.error);
        }
    } catch (error) {
        console.error('Error saving tasks:', error);
    }
}

// Function to load tasks on startup
async function loadTasks() {
    try {
        const result = await ipcRenderer.invoke('load-tasks');
        if (result.success && result.tasks.length > 0) {
            // Clear existing tasks
            taskList.innerHTML = '';
            
            // Sort tasks by order and recreate them
            result.tasks.sort((a, b) => a.order - b.order).forEach(task => {
                createTaskFromData(task);
            });
            
            console.log('Tasks loaded successfully');
        }
        
        await new Promise(resolve);
        
    } catch (error) {
        console.error('Error loading tasks:', error);
    }
}

// Function to create a task element from saved data
function createTaskFromData(taskData) {
    const taskDiv = document.createElement('div');
    taskDiv.className = 'task';
    
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
ipcRenderer.on('request-tasks-for-save', () => {
    saveTasks();
});

// Function to add a new task
function doAddTask() {
    const taskText = taskInput.value;
    if (taskText && taskText.trim() !== '') {
        const taskDiv = document.createElement('div');
        taskDiv.className = 'task';

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
        taskInput.value = '';
        
        // Hide modal and show add button
        taskModal.style.display = 'none';
        addTaskBtn.style.display = 'block';
        
        // Save tasks after adding
        //saveTasks();
    }
}

// Load tasks when the app starts
document.addEventListener('DOMContentLoaded', async () => {   
    console.log('DOM loaded, loading tasks...');
    await loadTasks();
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

addTaskBtn.addEventListener('click', () => {
    console.log('Add new task button pressed');
    taskInput.value = '';
    taskModal.style.display = 'block';
    addTaskBtn.style.display = 'none';
    taskInput.focus();
});

// Cancel button functionality
taskCancelBtn.addEventListener('click', () => {
    taskModal.style.display = 'none';
    addTaskBtn.style.display = 'block';
    taskInput.value = '';
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

// Handle task submission
taskSubmitBtn.addEventListener('click', doAddTask);

// Allow Enter key to submit
document.addEventListener('keydown', (e) => {
    switch (e.key) {
        case 'Enter':
            if (taskModal.style.display === 'block') {
                doAddTask();
            } else if (editModal.style.display === 'flex') {
                hideEditModal(); // Auto-save and close
            }
            break;
        case 'Escape':
            if (taskModal.style.display === 'block') {
                taskModal.style.display = 'none';
                addTaskBtn.style.display = 'block';
            } else if (editModal.style.display === 'flex') {
                hideEditModal(); // Auto-save and close
            }
            break;
    }
});

// Edit modal functions
function showEditModal(taskDiv, taskTextSpan) {
    // Close add task modal if it's open
    if (taskModal.style.display === 'block') {
        taskModal.style.display = 'none';
        addTaskBtn.style.display = 'block';
    }
    
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
            //saveTasks(); // Save after editing
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
        //saveTasks(); // Save after deletion
        editModal.style.display = 'none';
        editModalContent.classList.remove('modified');
        currentEditTask = null;
        originalTaskText = '';
    }
}

function toggleTaskCompletion(taskDiv, checkbox) {
    if (checkbox.checked) {
        // Start the completion animation sequence
        taskDiv.classList.add('completing');
        
        // After the pop animation, add the completed state
        setTimeout(() => {
            taskDiv.classList.remove('completing');
            taskDiv.classList.add('completed');
        }, 300);
        
    } else {
        // Remove completed state when unchecked
        taskDiv.classList.remove('completed');
        taskDiv.classList.remove('completing');
    }
    
    // Save tasks after completion state change
    //saveTasks();
}
