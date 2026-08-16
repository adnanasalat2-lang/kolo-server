const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ============================================================
// DATA DIRECTORY SETUP
// ============================================================
const dataDir = fs.existsSync('/app/data') ? '/app/data' : __dirname;
const IMAGES_DIR = path.join(dataDir, 'task_images'); // Images alag folder mein
const TRAINED_FILE = path.join(dataDir, 'trained_data.json');
const PENDING_FILE = path.join(dataDir, 'pending_data.json');

// Images folder banao agar nahi hai
if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// ============================================================
// MEMORY: Sirf metadata RAM mein, images disk par
// ============================================================
// pendingTasks format: { taskId: { id, profileId, imagePath, status, timestamp } }
// trainedTasks format: { taskId: { id, clicks, timestamp } }
let pendingTasks = {};
let trainedTasks = {};

// ============================================================
// STARTUP: Load existing data
// ============================================================
if (fs.existsSync(TRAINED_FILE)) {
    try {
        trainedTasks = JSON.parse(fs.readFileSync(TRAINED_FILE, 'utf8'));
        console.log(`Trained data loaded: ${Object.keys(trainedTasks).length} tasks`);
    } catch (err) { console.log("Trained load error:", err.message); }
}

if (fs.existsSync(PENDING_FILE)) {
    try {
        pendingTasks = JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8'));
        // Cleanup: Remove pending tasks whose image file got deleted
        let cleaned = 0;
        for (let id of Object.keys(pendingTasks)) {
            const t = pendingTasks[id];
            if (t.imagePath && !fs.existsSync(t.imagePath)) {
                delete pendingTasks[id];
                cleaned++;
            }
        }
        if (cleaned > 0) console.log(`Cleaned ${cleaned} orphaned pending tasks`);
        console.log(`Pending data loaded: ${Object.keys(pendingTasks).length} tasks`);
    } catch (err) { console.log("Pending load error:", err.message); }
}

// ============================================================
// SAVE HELPERS
// ============================================================
function saveTrainedData() {
    fs.writeFileSync(TRAINED_FILE, JSON.stringify(trainedTasks, null, 2));
}
function savePendingData() {
    fs.writeFileSync(PENDING_FILE, JSON.stringify(pendingTasks, null, 2));
}

// Image ko disk par save karna aur path return karna
function saveImageToDisk(taskId, base64DataUrl) {
    try {
        // base64 data URL se actual data nikalna
        const matches = base64DataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        let buffer;
        let ext = 'png';

        if (matches && matches[2]) {
            buffer = Buffer.from(matches[2], 'base64');
            if (matches[1] === 'image/jpeg') ext = 'jpg';
        } else {
            // Agar data URL nahi hai, seedha base64 hai ya URL hai
            // URL case: image ko disk par save mat karo, URL hi use karo
            return null;
        }

        const imagePath = path.join(IMAGES_DIR, `${taskId}.${ext}`);
        fs.writeFileSync(imagePath, buffer);
        return imagePath;
    } catch (err) {
        console.log(`Image save error for ${taskId}:`, err.message);
        return null;
    }
}

// Image ko disk se padhna aur base64 URL banana
function loadImageFromDisk(imagePath) {
    try {
        if (!imagePath || !fs.existsSync(imagePath)) return null;
        const buffer = fs.readFileSync(imagePath);
        const ext = path.extname(imagePath).toLowerCase();
        const mime = ext === '.jpg' ? 'image/jpeg' : 'image/png';
        return `data:${mime};base64,${buffer.toString('base64')}`;
    } catch (err) {
        return null;
    }
}

// ============================================================
// API ROUTES
// ============================================================

// 1. Naya task receive karna
app.post('/api/new-task', (req, res) => {
    const taskId = req.body.taskId || req.body.id;
    const profileId = req.body.profileId || req.body.taskData?.profileId || 'Unknown';
    const imageSource = req.body.image || req.body.taskData?.image || '';

    if (!taskId) return res.status(400).json({ error: "taskId required" });

    // Pehle se exist karta hai toh skip
    if (pendingTasks[taskId] || trainedTasks[taskId]) {
        return res.json({ success: true, taskId, status: 'already_exists' });
    }

    // Image ko disk par save karo (RAM mein nahi!)
    let imagePath = null;
    let imageUrl = imageSource; // External URL case ke liye

    if (imageSource.startsWith('data:')) {
        // Base64 image - disk par save karo
        imagePath = saveImageToDisk(taskId, imageSource);
        imageUrl = null; // Disk se load hogi
    }
    // Agar external URL hai toh imagePath null rahega, imageUrl use hogi

    pendingTasks[taskId] = {
        id: taskId,
        profileId: profileId,
        imagePath: imagePath,       // Disk path (base64 images ke liye)
        imageUrl: imageUrl,         // External URL (agar base64 nahi)
        status: 'pending',
        timestamp: new Date().toLocaleTimeString()
    };

    savePendingData();
    console.log(`New task saved (image on disk): ${taskId}`);
    res.json({ success: true, taskId });
});

// 2. Dashboard ke liye tasks - image on demand load karna
app.get('/api/get-tasks', (req, res) => {
    // Pending tasks mein images attach karna (disk se padhna)
    const pendingWithImages = {};
    for (let [id, task] of Object.entries(pendingTasks)) {
        let imageData = task.imageUrl; // External URL
        if (!imageData && task.imagePath) {
            imageData = loadImageFromDisk(task.imagePath); // Disk se load
        }
        pendingWithImages[id] = {
            id: task.id,
            profileId: task.profileId,
            status: task.status,
            timestamp: task.timestamp,
            taskData: { image: imageData || '' }
        };
    }

    res.json({
        pending: pendingWithImages,
        trained: trainedTasks
    });
});

// 3. Training submit karna
app.post('/api/submit-clicks', (req, res) => {
    const { taskId, clicks } = req.body;

    if (pendingTasks[taskId]) {
        // Image file delete karo (ab zaroorat nahi)
        if (pendingTasks[taskId].imagePath && fs.existsSync(pendingTasks[taskId].imagePath)) {
            try { fs.unlinkSync(pendingTasks[taskId].imagePath); } catch (e) {}
        }

        trainedTasks[taskId] = {
            id: taskId,
            clicks: clicks,
            status: 'solved',
            timestamp: new Date().toLocaleTimeString()
        };
        delete pendingTasks[taskId];

        saveTrainedData();
        savePendingData();

        console.log(`Task ${taskId} trained with ${clicks.length} clicks.`);
        res.json({ success: true });

    } else if (trainedTasks[taskId]) {
        trainedTasks[taskId].clicks = clicks;
        saveTrainedData();
        res.json({ success: true });

    } else {
        res.status(404).json({ error: "Task not found" });
    }
});

// 4. Task delete karna
app.delete('/api/delete-task/:taskId', (req, res) => {
    const taskId = req.params.taskId;

    if (pendingTasks[taskId]) {
        // Image file bhi delete karo
        if (pendingTasks[taskId].imagePath && fs.existsSync(pendingTasks[taskId].imagePath)) {
            try { fs.unlinkSync(pendingTasks[taskId].imagePath); } catch (e) {}
        }
        delete pendingTasks[taskId];
        savePendingData();
    }
    if (trainedTasks[taskId]) {
        delete trainedTasks[taskId];
        saveTrainedData();
    }
    res.json({ success: true });
});

// 5. Extension ke liye check karna
app.get('/api/check-task/:taskId', (req, res) => {
    const taskId = req.params.taskId;
    if (trainedTasks[taskId]) {
        res.json({ status: 'solved', clicks: trainedTasks[taskId].clicks });
    } else {
        res.json({ status: 'pending' });
    }
});

// 6. Memory/disk stats dekhna (debug ke liye)
app.get('/api/stats', (req, res) => {
    const pendingCount = Object.keys(pendingTasks).length;
    const trainedCount = Object.keys(trainedTasks).length;

    let imagesDirSize = 0;
    try {
        const files = fs.readdirSync(IMAGES_DIR);
        files.forEach(f => {
            try { imagesDirSize += fs.statSync(path.join(IMAGES_DIR, f)).size; } catch (e) {}
        });
    } catch (e) {}

    res.json({
        pending: pendingCount,
        trained: trainedCount,
        images_on_disk: Math.round(imagesDirSize / 1024 / 1024 * 100) / 100 + ' MB',
        ram_usage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB'
    });
});

// ============================================================
// SERVER START
// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Kolo Server running on port ${PORT}`);
    console.log(`Data dir: ${dataDir}`);
    console.log(`Images dir: ${IMAGES_DIR}`);
});
