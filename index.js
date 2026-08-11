const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' })); 

let pendingTasks = {}; // jo task hal hone baqi hain
let trainedTasks = {}; // jo task train ho chuke hain (history ke liye)

// 1. Naya task receive karna (multi-task queue)
app.post('/api/new-task', (req, res) => {
    const taskPayload = req.body;
    const taskId = taskPayload.id || Date.now().toString();
    
    // Agar pehle se yeh task mojood nahi toh pending mein add kar do
    if (!pendingTasks[taskId] && !trainedTasks[taskId]) {
        pendingTasks[taskId] = {
            id: taskId,
            taskData: taskPayload,
            status: 'pending',
            clicks: [],
            timestamp: new Date().toLocaleTimeString()
        };
        console.log("New task added to queue:", taskId);
    }
    res.json({ success: true, taskId: taskId });
});

// 2. Tamam pending aur trained task dashboard ko bhejna
app.get('/api/get-tasks', (req, res) => {
    res.json({
        pending: pendingTasks,
        trained: trainedTasks
    });
});

// 3. Training submit karna aur usay Trained list mein dalna
app.post('/api/submit-clicks', (req, res) => {
    const { taskId, clicks } = req.body;
    if (pendingTasks[taskId]) {
        pendingTasks[taskId].clicks = clicks;
        pendingTasks[taskId].status = 'solved';
        
        // Trained task ko history mein mehfooz kar lena
        trainedTasks[taskId] = pendingTasks[taskId];
        
        // Pending se hata dena
        delete pendingTasks[taskId];
        
        console.log(`Task ${taskId} trained successfully with ${clicks.length} clicks.`);
        res.json({ success: true });
    } else if (trainedTasks[taskId]) {
        // Agar pehle se trained hai aur update kar rahe hain
        trainedTasks[taskId].clicks = clicks;
        console.log(`Task ${taskId} updated successfully.`);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: "Task not found" });
    }
});

// 4. Task delete karne ka route
app.delete('/api/delete-task/:taskId', (req, res) => {
    const taskId = req.params.taskId;
    delete pendingTasks[taskId];
    delete trainedTasks[taskId];
    console.log(`Task ${taskId} deleted.`);
    res.json({ success: true });
});

// 5. Extension ke liye check karna ke task solve hua ya nahi
app.get('/api/check-task/:taskId', (req, res) => {
    const task = trainedTasks[req.params.taskId] || pendingTasks[req.params.taskId];
    if (task && task.status === 'solved') {
        res.json({ status: 'solved', clicks: task.clicks });
    } else {
        res.json({ status: 'pending' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Kolo Master Server running on port ${PORT}`));
