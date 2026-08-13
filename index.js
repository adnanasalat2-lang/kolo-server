const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' })); 

// سمارٹ پاتھ: اگر Railway پر Volume ہے تو وہاں سیو کرے، ورنہ لوکل فولڈر میں
const dataDir = fs.existsSync('/app/data') ? '/app/data' : __dirname;
const TRAINED_FILE = path.join(dataDir, 'trained_data.json');
const PENDING_FILE = path.join(dataDir, 'pending_data.json'); // 🚀 NAYI FILE: Pending tasks ko bachane ke liye

let pendingTasks = {}; 
let trainedTasks = {}; 

// 1. سرور سٹارٹ ہوتے ہی پرانا ڈیٹا فائلز سے لوڈ کرنا (Trained + Pending)
if (fs.existsSync(TRAINED_FILE)) {
    try {
        trainedTasks = JSON.parse(fs.readFileSync(TRAINED_FILE, 'utf8'));
        console.log(`Purana Trained Data Load Ho Gaya! Total: ${Object.keys(trainedTasks).length}`);
    } catch (err) { console.log("Trained data load error:", err); }
}

if (fs.existsSync(PENDING_FILE)) {
    try {
        pendingTasks = JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8'));
        console.log(`Purana Pending Data Load Ho Gaya! Total: ${Object.keys(pendingTasks).length}`);
    } catch (err) { console.log("Pending data load error:", err); }
}

// 2. ڈیٹا کو ہمیشہ کے لیے فائل میں سیو کرنے کے فنکشنز
function saveTrainedData() { fs.writeFileSync(TRAINED_FILE, JSON.stringify(trainedTasks, null, 2)); }
function savePendingData() { fs.writeFileSync(PENDING_FILE, JSON.stringify(pendingTasks, null, 2)); }


// 🚀 AUTO-CLEANER HATA DIYA GAYA HAI! Ab koi task khud delete nahi hoga.


// نئے ٹاسک ریسیو کرنا
app.post('/api/new-task', (req, res) => {
    const taskId = req.body.taskId || req.body.id; 
    const taskPayload = req.body.taskData || req.body;

    if (!pendingTasks[taskId] && !trainedTasks[taskId]) {
        pendingTasks[taskId] = {
            id: taskId,
            taskData: taskPayload, 
            status: 'pending',
            clicks: [],
            timestamp: new Date().toLocaleTimeString()
        };
        
        savePendingData(); // <--- آتے ہی Pending فائل میں سیو کر لیا تاکہ کریش ہونے پر ضائع نہ ہو
        console.log("New task added to queue & saved safely:", taskId);
    }
    res.json({ success: true, taskId: taskId });
});

app.get('/api/get-tasks', (req, res) => {
    res.json({ pending: pendingTasks, trained: trainedTasks });
});

// ٹاسک سالو ہونے پر سیو کرنا
app.post('/api/submit-clicks', (req, res) => {
    const { taskId, clicks } = req.body;

    if (pendingTasks[taskId]) {
        trainedTasks[taskId] = {
            id: taskId,
            clicks: clicks,
            status: 'solved',
            timestamp: new Date().toLocaleTimeString()
        };
        delete pendingTasks[taskId]; // Pending سے نکال دیا
        
        saveTrainedData(); // Trained فائل میں سیو
        savePendingData(); // Pending فائل کو بھی اپڈیٹ کر دیا
        
        console.log(`Task ${taskId} trained & saved permanently.`);
        res.json({ success: true });
        
    } else if (trainedTasks[taskId]) {
        trainedTasks[taskId].clicks = clicks;
        saveTrainedData(); 
        console.log(`Task ${taskId} updated & saved.`);
        res.json({ success: true });
        
    } else {
        res.status(404).json({ error: "Task not found" });
    }
});

app.delete('/api/delete-task/:taskId', (req, res) => {
    const taskId = req.params.taskId;
    
    if (pendingTasks[taskId]) {
        delete pendingTasks[taskId];
        savePendingData(); // ڈیلیٹ ہونے پر Pending فائل اپڈیٹ
    }
    if (trainedTasks[taskId]) {
        delete trainedTasks[taskId];
        saveTrainedData(); // ڈیلیٹ ہونے پر Trained فائل اپڈیٹ
    }
    res.json({ success: true });
});

app.get('/api/check-task/:taskId', (req, res) => {
    const taskId = req.params.taskId;
    if (trainedTasks[taskId]) {
        res.json({ status: 'solved', clicks: trainedTasks[taskId].clicks });
    } else {
        res.json({ status: 'pending' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Lightweight Kolo Server on port ${PORT} 🚀`));
