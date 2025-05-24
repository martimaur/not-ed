const { ipcRenderer } = require('electron');
console.log('Hello worlds!');
// Task management UI
const taskList = document.querySelector('.task-list');
const addTaskBtn = document.getElementById('add-task-btn');
const taskModal = document.getElementById('task-modal');
const taskInput = document.getElementById('task-input');
const taskSubmitBtn = document.getElementById('task-submit-btn');
const taskCancelBtn = document.getElementById('task-cancel-btn');
//const Sortable = require('sortablejs');

function doAddTask() {
    const taskText = taskInput.value;
    if (taskText && taskText.trim() !== '') {
        const taskDiv = document.createElement('div');
        taskDiv.className = 'task';
        taskList.appendChild(taskDiv);
        const span = document.createElement('span');
        span.className = 'task-text';
        span.textContent = taskText;
        taskDiv.appendChild(span);
        taskInput.value = ''; // Clear the input field after submission
    }
}

document.addEventListener('DOMContentLoaded', () => {
    Sortable.create(taskList, {
        animation: 240,
        ghostClass: 'sortable-ghost'
    });
});

addTaskBtn.addEventListener('click', () => {
    console.log('Add new task button pressed');
    taskInput.value = '';
    taskModal.style.display = 'block';
    addTaskBtn.style.display = 'none';
    taskInput.focus();
});

taskCancelBtn.addEventListener('click', () => {
    taskModal.style.display = 'none';
    addTaskBtn.style.display = 'block';
});

// Handle task submission
taskSubmitBtn.addEventListener('click', () => {
    doAddTask();
});

// Allow Enter key to submit
document.addEventListener('keydown', (e) => {
    switch (e.key) {
        case 'Enter': // Allow Enter key to submit
            doAddTask();
            break;
        case 'Escape': // Allow Escape key to cancel
            taskModal.style.display = 'none';
            addTaskBtn.style.display = 'block';
            break;
    }
});
