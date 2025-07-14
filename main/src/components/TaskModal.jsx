import React, { useState, useEffect } from 'react';

function TaskModal({ onAdd, onCancel }) {
    const [taskText, setTaskText] = useState('');

    useEffect(() => {
        // Focus on input when modal opens
        const input = document.getElementById('task-input');
        if (input) {
            input.focus();
        }
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (taskText.trim()) {
            onAdd(taskText.trim());
            setTaskText('');
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            onCancel();
        } else if (e.key === 'Enter') {
            handleSubmit(e);
        }
    };

    return (
        <div id="task-modal" className="modal">
            <div className="task">
                <input
                    type="text"
                    id="task-input"
                    placeholder="Enter new task"
                    value={taskText}
                    onChange={(e) => setTaskText(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
                <button id="task-submit-btn" onClick={handleSubmit}>
                    Add
                </button>
                <button id="task-cancel-btn" onClick={onCancel}>
                    Cancel
                </button>
            </div>
        </div>
    );
}

export default TaskModal;
