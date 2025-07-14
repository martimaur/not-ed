import React from 'react';

function AddTaskButton({ onClick }) {
    return (
        <button className="add-task-btn" onClick={onClick}>
            <span className="plus-icon">+</span>
        </button>
    );
}

export default AddTaskButton;
