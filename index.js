const express = require('express');
const cors = require('cors');
const fs = require('fs'); 
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' })); 

let hcaptchaPending = {};
let hcaptchaTrained = {};

// 🚀 JADU 1: Server on hotay hi purani Trained Memory wapas load karna
const MEMORY_FILE = 'memory.json';
if (fs.existsSync(MEMORY_FILE)) {
    try {
        let data = fs.readFileSync(MEMORY_FILE);
        hcaptchaTrained = JSON.parse(data);
        console.log(`[Success] Old Trained Memory Loaded! Total Tasks: ${Object.keys(hcaptchaTrained).length}`);
    } catch (e) {
        console.log("Memory load error, starting fresh.");
    }
}

// 🚀 JADU 2: Smart Auto-Cleaner (Sirf purane PENDING tasks ko delete karega taake RAM full na ho)
setInterval(() => {
    let now = Date.now();
    let deletedCount = 0;
    
    for (let taskId in hcaptchaPending) {
        let taskTime = new Date(hcaptchaPending[taskId].timestamp).getTime();
        // Agar koi pending task 5 minute (300,000 ms) se purana hai, usay RAM se nikal do
        if (now - taskTime > 300000) {
            delete hcaptchaPending[taskId];
            deletedCount++;
        }
    }
    
    if (deletedCount > 0) {
        console.log(`[Memory Cleaner] ${deletedCount} old pending tasks removed. RAM Freed!`);
        if (global.gc) global.gc(); // Node.js ko kachra saaf karne ka order
    }
}, 300000); // Har 5 minute baad check karega

// 1. Naya hCaptcha Task Receive Karna
app.post('/api/new-hcaptcha', (req, res) => {
    const task = req.body;
    
    if (hcaptchaTrained[task.taskId]) {
        return res.json({ success: true, status: 'already_trained' });
    }
    
    if (!hcaptchaPending[task.taskId]) {
        hcaptchaPending[task.taskId] = {
            id: task.taskId,
            prompt: task.prompt,
            media: task.media,
            timestamp: task.timestamp
        };
        console.log(`[New hCaptcha] ID: #${task.taskId} received!`);
    }
    res.json({ success: true });
});

// 2. Dashboard ke liye Tasks Bhejna
app.get('/api/get-hcaptcha', (req, res) => {
    res.json({
        pending: hcaptchaPending,
        trained: hcaptchaTrained
    });
});

// 3. Extension ke liye Task Status Check Karna
app.get('/api/check-hcaptcha/:id', (req, res) => {
    const taskId = req.params.id;
    if (hcaptchaTrained[taskId]) {
        res.json({ status: 'solved', clicks: hcaptchaTrained[taskId].clicks });
    } else {
        res.json({ status: 'pending' });
    }
});

// 4. Dashboard se Training Data Save Karna (🚀 Paki File Mein Save Hoga)
app.post('/api/submit-hcaptcha', (req, res) => {
    const { taskId, clicks, prompt } = req.body;
    
    hcaptchaTrained[taskId] = {
        id: taskId,
        clicks: clicks,
        prompt: prompt || "Trained Task",
        trainedAt: new Date().toISOString()
    };
    
    delete hcaptchaPending[taskId];
    
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(hcaptchaTrained));
    
    console.log(`[Trained & Saved] hCaptcha ID: #${taskId} safely stored in file.`);
    res.json({ success: true });
});

// 5. Dashboard se Task Delete Karna
app.delete('/api/delete-hcaptcha/:id', (req, res) => {
    const taskId = req.params.id;
    
    if (hcaptchaPending[taskId]) delete hcaptchaPending[taskId];
    if (hcaptchaTrained[taskId]) {
        delete hcaptchaTrained[taskId];
        fs.writeFileSync(MEMORY_FILE, JSON.stringify(hcaptchaTrained));
    }
    
    console.log(`[Deleted] hCaptcha ID: #${taskId}`);
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`hCaptcha Master Server is running on port ${PORT} 🚀`);
});
