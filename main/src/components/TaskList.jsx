import React from 'react';

function TaskList({ tasks, onToggle }) {
    return (
        <div className="task-list">
            {tasks.map(task => (
                <div key={task.id} className="task">
                    <span className={`task-text ${task.completed ? 'completed' : ''}`}>
                        {task.text}
                    </span>
                    <input
                        type="checkbox"
                        className="task-checkbox"
                        checked={task.completed}
                        onChange={() => onToggle(task.id)}
                    />
                </div>
            ))}
        </div>
    );
}

export default TaskList;
