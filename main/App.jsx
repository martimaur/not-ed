import React, { useState } from 'react';
import TaskList from './components/TaskList';
import AddTaskButton from './components/AddTaskButton';
import TaskModal from './components/TaskModal';
import './App.css';

function App() {
    const [tasks, setTasks] = useState([]);
    const [showModal, setShowModal] = useState(false);

    const addTask = (taskText) => {
        const newTask = {
            id: Date.now(),
            text: taskText,
            completed: false
        };
        setTasks([...tasks, newTask]);
        setShowModal(false);
    };

    const toggleTask = (id) => {
        setTasks(tasks.map(task => 
            task.id === id ? { ...task, completed: !task.completed } : task
        ));
    };

    return (
        <div className="app">
            <header>
                <h1>¬ed</h1>
            </header>
            <main>
                <TaskList tasks={tasks} onToggle={toggleTask} />
                <AddTaskButton onClick={() => setShowModal(true)} />
                {showModal && (
                    <TaskModal 
                        onAdd={addTask}
                        onCancel={() => setShowModal(false)}
                    />
                )}
            </main>
        </div>
    );
}

export default App;