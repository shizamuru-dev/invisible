const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const devices = new Map();        // deviceId -> { publicKey, nickname, avatar, online }
const messageQueue = new Map();   // deviceId -> array of messages
const blockedMap = new Map();     // deviceId -> Set(blockedDeviceId)
let nextDeviceId = 1;
const connections = new Map();    // deviceId -> WebSocket

function setOnline(deviceId, ws) {
    const device = devices.get(deviceId);
    if (device) { device.online = true; connections.set(deviceId, ws); }
}
function setOffline(deviceId) {
    const device = devices.get(deviceId);
    if (device) { device.online = false; connections.delete(deviceId); }
}

// ------------------- REST API -------------------
app.post('/register', (req, res) => {
    const deviceId = `dev_${nextDeviceId++}`;
    const publicKey = req.body.publicKey;
    if (!publicKey) return res.status(400).json({ error: 'publicKey required' });
    const nickname = `User${deviceId.slice(-4)}`;
    devices.set(deviceId, { publicKey, nickname, avatar: null, online: false });
    blockedMap.set(deviceId, new Set());
    console.log(`[REGISTER] ${deviceId} (${nickname})`);
    res.json({ deviceId, nickname });
});

app.get('/keys/:deviceId', (req, res) => {
    const device = devices.get(req.params.deviceId);
    if (!device) return res.status(404).json({ error: 'Device not found' });
    res.json({ publicKey: device.publicKey });
});

app.get('/nickname/:deviceId', (req, res) => {
    const device = devices.get(req.params.deviceId);
    if (!device) return res.status(404).json({ error: 'Device not found' });
    res.json({ nickname: device.nickname, avatar: device.avatar });
});

app.post('/update-nickname', (req, res) => {
    const { deviceId, nickname } = req.body;
    const device = devices.get(deviceId);
    if (!device) return res.status(404).json({ error: 'Device not found' });
    device.nickname = nickname;
    res.json({ success: true });
});

app.post('/update-avatar', (req, res) => {
    const { deviceId, avatar } = req.body;
    const device = devices.get(deviceId);
    if (!device) return res.status(404).json({ error: 'Device not found' });
    device.avatar = avatar;
    res.json({ success: true });
});

app.post('/messages', (req, res) => {
    const { recipientDeviceId, encrypted, metadata, type, from } = req.body;
    if (!recipientDeviceId || !encrypted) return res.status(400).json({ error: 'Missing fields' });
    const senderId = from || req.query.senderId;
    if (!senderId) return res.status(400).json({ error: 'senderId required' });
    
    const blockedSet = blockedMap.get(recipientDeviceId);
    if (blockedSet && blockedSet.has(senderId)) return res.status(403).json({ error: 'Blocked' });
    
    const messageId = `${Date.now()}_${Math.random().toString(36)}`;
    const msgType = type || (metadata ? 'file' : 'text');
    const messageObj = { 
        id: messageId, 
        from: senderId, 
        type: msgType, 
        encrypted, 
        metadata: metadata || null, 
        timestamp: Date.now() 
    };
    
    if (!messageQueue.has(recipientDeviceId)) messageQueue.set(recipientDeviceId, []);
    messageQueue.get(recipientDeviceId).push(messageObj);
    
    const ws = connections.get(recipientDeviceId);
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'new_message', messageId, from: senderId }));
    }
    console.log(`[MESSAGE] ${senderId} -> ${recipientDeviceId} (${msgType})`);
    res.json({ status: 'ok', messageId });
});

app.get('/messages/:messageId', (req, res) => {
    const messageId = req.params.messageId;
    for (let [deviceId, messages] of messageQueue.entries()) {
        const index = messages.findIndex(m => m.id === messageId);
        if (index !== -1) {
            const msg = messages[index];
            messages.splice(index, 1);
            if (messages.length === 0) messageQueue.delete(deviceId);
            return res.json({
                encrypted: msg.encrypted,
                type: msg.type,
                metadata: msg.metadata,
                from: msg.from,
                timestamp: msg.timestamp
            });
        }
    }
    res.status(404).json({ error: 'Message not found' });
});

app.post('/block', (req, res) => {
    const { deviceId, blockedId } = req.body;
    if (!deviceId || !blockedId) return res.status(400).json({ error: 'Missing ids' });
    const blockedSet = blockedMap.get(deviceId);
    if (blockedSet) blockedSet.add(blockedId);
    res.json({ success: true });
});

app.post('/unblock', (req, res) => {
    const { deviceId, blockedId } = req.body;
    if (!deviceId || !blockedId) return res.status(400).json({ error: 'Missing ids' });
    const blockedSet = blockedMap.get(deviceId);
    if (blockedSet) blockedSet.delete(blockedId);
    res.json({ success: true });
});

app.get('/blocked/:deviceId', (req, res) => {
    const blockedSet = blockedMap.get(req.params.deviceId);
    res.json({ blocked: blockedSet ? Array.from(blockedSet) : [] });
});

app.get('/status/:deviceId', (req, res) => {
    const device = devices.get(req.params.deviceId);
    res.json({ online: device ? device.online : false });
});

// ------------------- WebSocket -------------------
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const deviceId = url.searchParams.get('deviceId');
    if (!deviceId) { ws.close(); return; }
    const device = devices.get(deviceId);
    if (!device) { ws.close(); return; }
    setOnline(deviceId, ws);
    console.log(`[WS CONNECT] ${deviceId}`);
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            console.log(`[WS MSG] from ${deviceId}:`, data);
            if (data.type === 'action') {
                const recipientId = data.recipientId;
                const recipientWs = connections.get(recipientId);
                if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
                    recipientWs.send(JSON.stringify({
                        type: 'action',
                        from: deviceId,
                        action: data.action
                    }));
                    console.log(`[ACTION] ${deviceId} -> ${recipientId}: ${data.action}`);
                } else {
                    console.log(`[ACTION] recipient ${recipientId} not connected`);
                }
            }
        } catch (err) {
            console.error('WS message error:', err);
        }
    });
    
    ws.on('close', () => setOffline(deviceId));
});

server.listen(5001, () => console.log('✅ Сервер запущен на http://localhost:5001'));