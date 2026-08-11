const express = require('express');
const cors = require('cors');
const app = express();

// Base64 امیجز کا سائز بڑا ہو سکتا ہے اس لیے limit بڑھا دی ہے
app.use(cors());
app.use(express.json({ limit: '50mb' })); 

let pendingTasks = {}; 

app.post('/api/new-task', (req, res) => {
    const taskId = Date.now().toString();
    pendingTasks[taskId] = {
        id: taskId,
        taskData: req.body,
        status: 'pending',
        clicks: []
    };
    console.log("New task received on server:", taskId);
    res.json({ success: true, taskId: taskId });
});

app.get('/api/get-tasks', (req, res) => {
    res.json(pendingTasks);
});

app.post('/api/submit-clicks', (req, res) => {
    const { taskId, clicks } = req.body;
    if (pendingTasks[taskId]) {
        pendingTasks[taskId].clicks = clicks;
        pendingTasks[taskId].status = 'solved';
        console.log(`Task ${taskId} trained with clicks:`, clicks);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: "Task not found" });
    }
});

app.get('/api/check-task/:taskId', (req, res) => {
    const task = pendingTasks[req.params.taskId];
    if (task && task.status === 'solved') {
        res.json({ status: 'solved', clicks: task.clicks });
        delete pendingTasks[req.params.taskId]; 
    } else {
        res.json({ status: 'pending' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Kolotibablo Task Server running on port ${PORT}`));