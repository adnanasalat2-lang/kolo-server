const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const dataDir = fs.existsSync('/app/data') ? '/app/data' : __dirname;
const TRAINED_FILE = path.join(dataDir, 'trained_data.json');
const PENDING_FILE = path.join(dataDir, 'pending_data.json');

let pendingTasks = {};
let trainedTasks = {};

if (fs.existsSync(TRAINED_FILE)) {
    try {
        trainedTasks = JSON.parse(fs.readFileSync(TRAINED_FILE, 'utf8'));
        console.log("Trained loaded: " + Object.keys(trainedTasks).length);
    } catch (e) { console.log("Trained load error:", e.message); }
}
if (fs.existsSync(PENDING_FILE)) {
    try {
        pendingTasks = JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8'));
        console.log("Pending loaded: " + Object.keys(pendingTasks).length);
    } catch (e) { console.log("Pending load error:", e.message); }
}

function saveTrainedData() { fs.writeFileSync(TRAINED_FILE, JSON.stringify(trainedTasks, null, 2)); }
function savePendingData() { fs.writeFileSync(PENDING_FILE, JSON.stringify(pendingTasks, null, 2)); }

// ============================================================
// NEW TASK - legacyId bhi save karo
// ============================================================
app.post('/api/new-task', (req, res) => {
    const taskId = req.body.id || req.body.taskId;
    const legacyId = req.body.legacyId; // Purana hash
    const profileId = req.body.profileId || 'Unknown';
    const image = req.body.image || '';

    if (!taskId) return res.status(400).json({ error: "id required" });

    // Agar purana legacyId already trained hai toh naye ID ko bhi trained mark karo
    // Yeh 6000 purane tasks ko naye hash se connect karega
    if (legacyId && trainedTasks[legacyId] && !trainedTasks[taskId]) {
        trainedTasks[taskId] = { ...trainedTasks[legacyId], id: taskId, linkedFrom: legacyId };
        saveTrainedData();
        console.log("Linked new hash " + taskId + " to legacy " + legacyId);
    }

    if (!pendingTasks[taskId] && !trainedTasks[taskId]) {
        pendingTasks[taskId] = {
            id: taskId,
            legacyId: legacyId,
            profileId: profileId,
            taskData: { image: image },
            status: 'pending',
            timestamp: new Date().toLocaleTimeString()
        };
        savePendingData();
    }

    res.json({ success: true, taskId });
});

// ============================================================
// GET TASKS
// ============================================================
app.get('/api/get-tasks', (req, res) => {
    res.json({ pending: pendingTasks, trained: trainedTasks });
});

// ============================================================
// SUBMIT CLICKS - dono hashes mein save karo
// ============================================================
app.post('/api/submit-clicks', (req, res) => {
    const { taskId, clicks } = req.body;

    if (pendingTasks[taskId]) {
        let legacyId = pendingTasks[taskId].legacyId;

        let trainedEntry = { id: taskId, clicks: clicks, status: 'solved', timestamp: new Date().toLocaleTimeString() };
        
        // Naye ID se save karo
        trainedTasks[taskId] = trainedEntry;

        // Purane legacyId se bhi save karo (6000 tasks ka system)
        if (legacyId && legacyId !== taskId) {
            trainedTasks[legacyId] = { ...trainedEntry, id: legacyId, linkedTo: taskId };
        }

        delete pendingTasks[taskId];
        saveTrainedData();
        savePendingData();

        console.log("Task trained: " + taskId + (legacyId ? " + legacy: " + legacyId : ""));
        res.json({ success: true });

    } else if (trainedTasks[taskId]) {
        trainedTasks[taskId].clicks = clicks;
        saveTrainedData();
        res.json({ success: true });
    } else {
        res.status(404).json({ error: "Task not found" });
    }
});

// ============================================================
// CHECK TASK - dono hashes check karo
// ============================================================
app.get('/api/check-task/:taskId', (req, res) => {
    const taskId = req.params.taskId;
    if (trainedTasks[taskId] && trainedTasks[taskId].clicks) {
        res.json({ status: 'solved', clicks: trainedTasks[taskId].clicks });
    } else {
        res.json({ status: 'pending' });
    }
});

// ============================================================
// DELETE TASK
// ============================================================
app.delete('/api/delete-task/:taskId', (req, res) => {
    const taskId = req.params.taskId;
    if (pendingTasks[taskId]) { delete pendingTasks[taskId]; savePendingData(); }
    if (trainedTasks[taskId]) { delete trainedTasks[taskId]; saveTrainedData(); }
    res.json({ success: true });
});

// ============================================================
// STATS
// ============================================================
app.get('/api/stats', (req, res) => {
    res.json({
        pending: Object.keys(pendingTasks).length,
        trained: Object.keys(trainedTasks).length,
        ram_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Kolo Server running on port " + PORT));
