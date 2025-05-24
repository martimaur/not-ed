const { ipcRenderer } = require('electron');
console.log('Hello worlds!');
// Task management UI
const taskList = document.querySelector('.task-list');
const addTaskBtn = document.getElementById('add-task-btn');
const taskModal = document.getElementById('task-modal');
const taskInput = document.getElementById('task-input');
const taskSubmitBtn = document.getElementById('task-submit-btn');
const taskCancelBtn = document.getElementById('task-cancel-btn');

addTaskBtn.addEventListener('click', () => {
    console.log('Add new task button pressed');
    taskInput.value = '';
    taskModal.style.display = 'block';
    taskInput.focus();
});

taskSubmitBtn.addEventListener('click', () => {
    const taskText = taskInput.value;
    if (taskText && taskText.trim() !== '') {
        const taskDiv = document.createElement('div');
        taskDiv.className = 'task';

        const span = document.createElement('span');
        span.className = 'task-text';
        span.textContent = taskText;
        taskDiv.appendChild(span);
    }
});

taskCancelBtn.addEventListener('click', () => {
    taskModal.style.display = 'none';
});

// Optional: allow Enter key to submit
taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') taskSubmitBtn.click();
});
