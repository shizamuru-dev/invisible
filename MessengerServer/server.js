const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // для файлов
app.use(express.raw({ type: 'application/octet-stream', limit: '50mb' }));

let devices = {};        // deviceId -> { publicKey, nickname }
let messages = {};       // recipientDeviceId -> массив { id, encrypted, type, metadata }
let nextId = 1;
const connections = new Map();

app.post('/register', (req, res) => {
    const deviceId = `dev_${nextId++}`;
    const defaultNickname = `User ${deviceId.slice(-4)}`;
    devices[deviceId] = {
        publicKey: req.body.publicKey,
        nickname: defaultNickname
    };
    console.log(`Registered ${deviceId} as "${defaultNickname}"`);
    res.json({ deviceId, nickname: defaultNickname });
});

app.get('/keys/:deviceId', (req, res) => {
    const dev = devices[req.params.deviceId];
    if (!dev) return res.status(404).json({ error: 'not found' });
    res.json({ publicKey: dev.publicKey, nickname: dev.nickname });
});

app.post('/messages', (req, res) => {
    const { recipientDeviceId, encrypted, type, metadata } = req.body;
    console.log(`POST /messages to ${recipientDeviceId} type=${type}`);
    if (!recipientDeviceId || !encrypted) {
        return res.status(400).json({ error: "Missing fields" });
    }
    if (!messages[recipientDeviceId]) messages[recipientDeviceId] = [];
    const msgId = Date.now() + '_' + Math.random();
    messages[recipientDeviceId].push({ id: msgId, encrypted, type, metadata });
    const ws = connections.get(recipientDeviceId);
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'new_message', messageId: msgId }));
        console.log(`Notified ${recipientDeviceId}`);
    } else {
        console.log(`No active WebSocket for ${recipientDeviceId}`);
    }
    res.json({ status: 'ok' });
});

app.get('/messages/:messageId', (req, res) => {
    console.log(`GET /messages/${req.params.messageId}`);
    for (let [devId, msgs] of Object.entries(messages)) {
        const idx = msgs.findIndex(m => m.id === req.params.messageId);
        if (idx !== -1) {
            const msg = msgs[idx];
            messages[devId].splice(idx, 1);
            return res.json({ encrypted: msg.encrypted, type: msg.type, metadata: msg.metadata });
        }
    }
    res.status(404).json({ error: 'Message not found' });
});

app.get('/status/:deviceId', (req, res) => {
    const ws = connections.get(req.params.deviceId);
    res.json({ online: ws && ws.readyState === WebSocket.OPEN });
});

app.get('/nickname/:deviceId', (req, res) => {
    const dev = devices[req.params.deviceId];
    if (!dev) return res.status(404).json({ error: 'not found' });
    res.json({ nickname: dev.nickname });
});

app.post('/update-nickname', (req, res) => {
    const { deviceId, nickname } = req.body;
    if (!deviceId || !nickname || nickname.trim() === '') {
        return res.status(400).json({ error: 'Invalid data' });
    }
    if (!devices[deviceId]) {
        return res.status(404).json({ error: 'Device not found' });
    }
    const oldNickname = devices[deviceId].nickname;
    devices[deviceId].nickname = nickname.trim();
    console.log(`Nickname changed: "${oldNickname}" -> "${nickname.trim()}"`);
    res.json({ success: true, nickname: nickname.trim() });
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const deviceId = url.searchParams.get('deviceId');
    if (deviceId) {
        connections.set(deviceId, ws);
        console.log(`WebSocket connected for ${deviceId}`);
    }
    ws.on('close', () => {
        if (deviceId) connections.delete(deviceId);
        console.log(`WebSocket disconnected for ${deviceId}`);
    });
});

server.listen(5001, () => {
    console.log('Server running on http://localhost:5001');
});