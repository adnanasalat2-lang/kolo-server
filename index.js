const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' })); 

let pendingTasks = {}; // جو ٹاسک حل ہونے باقی ہیں
let trainedTasks = {}; // جو ٹاسک ٹرین ہو چکے ہیں (ہسٹری کے لیے)

// 1. نیا ٹاسک ریسیو کرنا (ملٹی پل ٹاسکس کو لسٹ میں رکھنا)
app.post('/api/new-task', (req, res) => {
    const taskPayload = req.body;
    const taskId = taskPayload.id || Date.now().toString();
    
    // اگر پہلے سے یہ ٹاسک موجود نہیں تو پینڈنگ میں ایڈ کر دو
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

// 2. تمام پینڈنگ اور ٹرین شدہ ٹاسک ڈیش بورڈ کو بھیجنا
app.get('/api/get-tasks', (req, res) => {
    res.json({
        pending: pendingTasks,
        trained: trainedTasks
    });
});

// 3. ٹریننگ سبمٹ کرنا اور اسے Trained لسٹ میں ڈالنا
app.post('/api/submit-clicks', (req, res) => {
    const { taskId, clicks } = req.body;
    if (pendingTasks[taskId]) {
        pendingTasks[taskId].clicks = clicks;
        pendingTasks[taskId].status = 'solved';
        
        // ٹرین شدہ ٹاسک کو ہسٹری میں محفوظ کر لینا
        trainedTasks[taskId] = pendingTasks[taskId];
        
        // پینڈنگ سے ہٹا دینا
        delete pendingTasks[taskId];
        
        console.log(`Task ${taskId} trained successfully with ${clicks.length} clicks.`);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: "Task not found in pending" });
    }
});

// 4. ایکسٹینشن کے لیے چیک کرنا کہ ٹاسک سالو ہوا یا نہیں
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
