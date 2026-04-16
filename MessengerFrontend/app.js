console.log("E2EE Messenger Client");

const SERVER_URL = "http://localhost:5001";
let myKeyPair = null;      // { privateKey, publicKey } (CryptoKey)
let myDeviceId = null;
let ws = null;

// DOM элементы
const myDeviceIdSpan = document.getElementById("myDeviceId");
const recipientIdInput = document.getElementById("recipientId");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const messagesDiv = document.getElementById("messages");

// Вспомогательные функции криптографии
async function generateKeyPair() {
    return await window.crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveKey", "deriveBits"]
    );
}

async function exportPublicKeyJwk(publicKey) {
    return await window.crypto.subtle.exportKey("jwk", publicKey);
}

async function importPublicKeyJwk(jwk) {
    return await window.crypto.subtle.importKey(
        "jwk", jwk,
        { name: "ECDH", namedCurve: "P-256" },
        true,
        []
    );
}

// Шифрование сообщения для получателя
async function encryptMessage(recipientPublicKey, plaintext) {
    const ephemeralPair = await generateKeyPair();
    const sharedSecret = await window.crypto.subtle.deriveBits(
        { name: "ECDH", public: recipientPublicKey },
        ephemeralPair.privateKey,
        256
    );
    const aesKey = await window.crypto.subtle.importKey(
        "raw", sharedSecret,
        { name: "AES-GCM" },
        false,
        ["encrypt"]
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const ciphertext = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        aesKey,
        encoded
    );
    const ephemeralPublicJwk = await exportPublicKeyJwk(ephemeralPair.publicKey);
    return {
        ephemeralPublicKey: ephemeralPublicJwk,
        iv: Array.from(iv),
        ciphertext: Array.from(new Uint8Array(ciphertext))
    };
}

// Расшифровка сообщения
async function decryptMessage(encryptedPackage) {
    const ephemeralPublic = await importPublicKeyJwk(encryptedPackage.ephemeralPublicKey);
    const sharedSecret = await window.crypto.subtle.deriveBits(
        { name: "ECDH", public: ephemeralPublic },
        myKeyPair.privateKey,
        256
    );
    const aesKey = await window.crypto.subtle.importKey(
        "raw", sharedSecret,
        { name: "AES-GCM" },
        false,
        ["decrypt"]
    );
    const iv = new Uint8Array(encryptedPackage.iv);
    const ciphertext = new Uint8Array(encryptedPackage.ciphertext);
    const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        aesKey,
        ciphertext
    );
    return new TextDecoder().decode(decrypted);
}

// Регистрация с отправкой публичного ключа
async function register() {
    if (!myKeyPair) {
        myKeyPair = await generateKeyPair();
    }
    const publicJwk = await exportPublicKeyJwk(myKeyPair.publicKey);
    const response = await fetch(`${SERVER_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey: publicJwk })
    });
    const data = await response.json();
    myDeviceId = data.deviceId;
    myDeviceIdSpan.innerText = myDeviceId;
    console.log("Registered", myDeviceId);
}

// Отправка зашифрованного сообщения
async function sendMessage(recipientId, plaintext) {
    // 1. Получаем публичный ключ получателя
    const pubKeyResponse = await fetch(`${SERVER_URL}/keys/${recipientId}`);
    if (!pubKeyResponse.ok) {
        console.error("Recipient not found");
        return;
    }
    const { publicKey: recipientPublicJwk } = await pubKeyResponse.json();
    const recipientPublicKey = await importPublicKeyJwk(recipientPublicJwk);

    // 2. Шифруем
    const encrypted = await encryptMessage(recipientPublicKey, plaintext);

    // 3. Отправляем на сервер
    const payload = { recipientDeviceId: recipientId, encrypted };
    const response = await fetch(`${SERVER_URL}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    if (response.ok) {
        addMessageToUI(plaintext, true);
    } else {
        console.error("Send failed");
    }
}

// WebSocket – получение уведомлений
function connectWebSocket() {
    if (!myDeviceId) return;
    ws = new WebSocket(`ws://localhost:5001/ws?deviceId=${myDeviceId}`);
    ws.onopen = () => console.log("WebSocket connected");
    ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "new_message") {
            const response = await fetch(`${SERVER_URL}/messages/${data.messageId}`);
            if (!response.ok) return;
            const encrypted = await response.json();
            const plaintext = await decryptMessage(encrypted);
            addMessageToUI(plaintext, false);
        }
    };
    ws.onclose = () => setTimeout(connectWebSocket, 3000);
}

function addMessageToUI(text, isMine) {
    const msgDiv = document.createElement("div");
    msgDiv.className = `message ${isMine ? "my" : "other"}`;
    msgDiv.innerText = text;
    messagesDiv.appendChild(msgDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Запуск
window.onload = async () => {
    await register();
    connectWebSocket();

    sendBtn.onclick = async () => {
        const recipientId = recipientIdInput.value.trim();
        const text = messageInput.value.trim();
        if (!recipientId || !text) return;
        await sendMessage(recipientId, text);
        messageInput.value = "";
    };
};