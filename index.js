const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' })); 

// سمارٹ پاتھ: اگر Railway پر Volume ہے تو وہاں سیو کرے، ورنہ لوکل فولڈر میں
const dataDir = fs.existsSync('/app/data') ? '/app/data' : __dirname;
const DATA_FILE = path.join(dataDir, 'trained_data.json');

let pendingTasks = {}; 
let trainedTasks = {}; 

// 1. سرور سٹارٹ ہوتے ہی پرانا ٹرین کیا ہوا ڈیٹا فائل سے لوڈ کرنا
if (fs.existsSync(DATA_FILE)) {
    try {
        const rawData = fs.readFileSync(DATA_FILE, 'utf8');
        trainedTasks = JSON.parse(rawData);
        console.log(`Purana Data Load Ho Gaya! Total Trained Tasks: ${Object.keys(trainedTasks).length}`);
    } catch (err) {
        console.log("Data load karne mein error:", err);
    }
}

// 2. ڈیٹا کو ہمیشہ کے لیے فائل میں سیو کرنے کا فنکشن
function saveData() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(trainedTasks, null, 2));
}

app.post('/api/new-task', (req, res) => {
    const taskPayload = req.body;
    const taskId = taskPayload.id || Date.now().toString();
    
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

app.get('/api/get-tasks', (req, res) => {
    res.json({
        pending: pendingTasks,
        trained: trainedTasks
    });
});

app.post('/api/submit-clicks', (req, res) => {
    const { taskId, clicks } = req.body;
    
    if (pendingTasks[taskId]) {
        pendingTasks[taskId].clicks = clicks;
        pendingTasks[taskId].status = 'solved';
        
        trainedTasks[taskId] = pendingTasks[taskId];
        delete pendingTasks[taskId];
        
        saveData(); // <--- ٹرین ہونے پر فائل میں سیو کر رہا ہے
        console.log(`Task ${taskId} trained & saved permanently.`);
        res.json({ success: true });
        
    } else if (trainedTasks[taskId]) {
        trainedTasks[taskId].clicks = clicks;
        saveData(); // <--- اپڈیٹ ہونے پر بھی فائل میں سیو کر رہا ہے
        console.log(`Task ${taskId} updated & saved.`);
        res.json({ success: true });
        
    } else {
        res.status(404).json({ error: "Task not found" });
    }
});

app.delete('/api/delete-task/:taskId', (req, res) => {
    const taskId = req.params.taskId;
    delete pendingTasks[taskId];
    if (trainedTasks[taskId]) {
        delete trainedTasks[taskId];
        saveData(); // <--- ڈیلیٹ ہونے پر بھی فائل کو اپڈیٹ کر رہا ہے
    }
    res.json({ success: true });
});

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
