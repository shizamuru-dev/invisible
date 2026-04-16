import { useState, useEffect, useRef } from 'react';
import { ContactsSidebar, type Contact } from './components/contacts-sidebar';
import { ChatArea, type Message } from './components/chat-area';
import { DeviceIdHeader } from './components/device-id-header';
import { MessageInput } from './components/message-input';
import { SettingsModal } from './components/SettingsModal';
import { ThemeProvider, useTheme } from 'next-themes';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import './styles/globals.css';

const SERVER_URL = "http://localhost:5001";
const CONTACTS_STORAGE_KEY = "messenger_contacts";

// ---------- Криптография (без изменений) ----------
async function generateKeyPair(): Promise<CryptoKeyPair> {
    return await window.crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveKey", "deriveBits"]
    );
}
async function exportPublicKeyJwk(publicKey: CryptoKey): Promise<JsonWebKey> {
    return await window.crypto.subtle.exportKey("jwk", publicKey);
}
async function importPublicKeyJwk(jwk: JsonWebKey): Promise<CryptoKey> {
    return await window.crypto.subtle.importKey(
        "jwk", jwk,
        { name: "ECDH", namedCurve: "P-256" },
        true,
        []
    );
}
async function encryptMessage(recipientPublicKey: CryptoKey, plaintext: string): Promise<any> {
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
async function decryptMessage(encryptedPackage: any, myPrivateKey: CryptoKey): Promise<string> {
    const ephemeralPublic = await importPublicKeyJwk(encryptedPackage.ephemeralPublicKey);
    const sharedSecret = await window.crypto.subtle.deriveBits(
        { name: "ECDH", public: ephemeralPublic },
        myPrivateKey,
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
async function encryptFile(recipientPublicKey: CryptoKey, fileBuffer: ArrayBuffer): Promise<any> {
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
    const ciphertext = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        aesKey,
        fileBuffer
    );
    const ephemeralPublicJwk = await exportPublicKeyJwk(ephemeralPair.publicKey);
    return {
        ephemeralPublicKey: ephemeralPublicJwk,
        iv: Array.from(iv),
        ciphertext: Array.from(new Uint8Array(ciphertext))
    };
}
async function decryptFile(encryptedPackage: any, myPrivateKey: CryptoKey): Promise<ArrayBuffer> {
    const ephemeralPublic = await importPublicKeyJwk(encryptedPackage.ephemeralPublicKey);
    const sharedSecret = await window.crypto.subtle.deriveBits(
        { name: "ECDH", public: ephemeralPublic },
        myPrivateKey,
        256
    );
    const aesKey = await window.crypto.subtle.importKey(
        "raw", sharedSecret,
        { name: "AES-GCM" },
        false,
        ["decrypt"]
    );
    let iv: Uint8Array;
    if (encryptedPackage.iv instanceof Uint8Array) iv = encryptedPackage.iv;
    else if (Array.isArray(encryptedPackage.iv)) iv = new Uint8Array(encryptedPackage.iv);
    else throw new Error("Invalid iv");
    let ciphertext: Uint8Array;
    if (encryptedPackage.ciphertext instanceof Uint8Array) ciphertext = encryptedPackage.ciphertext;
    else if (Array.isArray(encryptedPackage.ciphertext)) ciphertext = new Uint8Array(encryptedPackage.ciphertext);
    else throw new Error("Invalid ciphertext");
    const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        aesKey,
        ciphertext
    );
    return decrypted;
}

// ---------- Компонент ----------
function AppContent() {
    const { theme, setTheme } = useTheme();
    const { t, toggleLanguage, language } = useLanguage();
    const [myDeviceId, setMyDeviceId] = useState<string | null>(null);
    const [myNickname, setMyNickname] = useState<string>("");
    const [recipientId, setRecipientId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [keyPair, setKeyPair] = useState<CryptoKeyPair | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem(CONTACTS_STORAGE_KEY);
        if (stored) {
            try { setContacts(JSON.parse(stored)); } catch (e) { console.error(e); }
        }
    }, []);
    useEffect(() => { localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(contacts)); }, [contacts]);

    useEffect(() => {
        const init = async () => {
            const kp = await generateKeyPair();
            setKeyPair(kp);
            const publicJwk = await exportPublicKeyJwk(kp.publicKey);
            const res = await fetch(`${SERVER_URL}/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publicKey: publicJwk }) });
            const data = await res.json();
            setMyDeviceId(data.deviceId);
            setMyNickname(data.nickname);
        };
        init();
    }, []);

    // WebSocket (без изменений, использует стандартный decryptMessage)
    useEffect(() => {
        if (!myDeviceId || !keyPair) return;
        const ws = new WebSocket(`ws://localhost:5001/ws?deviceId=${myDeviceId}`);
        ws.onopen = () => console.log("WebSocket connected");
        ws.onmessage = async (event) => {
            const data = JSON.parse(event.data);
            if (data.type === "new_message") {
                const response = await fetch(`${SERVER_URL}/messages/${data.messageId}`);
                if (response.ok) {
                    const { encrypted, type, metadata } = await response.json();
                    const now = new Date();
                    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const dateStr = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
                    if (type === "text") {
                        const plaintext = await decryptMessage(encrypted, keyPair.privateKey);
                        const newMsg: Message = { id: crypto.randomUUID(), senderId: recipientId ? recipientId : 'unknown', type: "text", content: plaintext, time: timeStr, date: dateStr };
                        setMessages(prev => [...prev, newMsg]);
                        if (recipientId) setContacts(prev => prev.map(c => c.id === recipientId ? { ...c, lastMessage: plaintext, timestamp: timeStr } : c));
                    } else if (type === "file") {
                        const newMsg: Message = { id: crypto.randomUUID(), senderId: recipientId ? recipientId : 'unknown', type: "file", fileData: { encrypted, metadata }, time: timeStr, date: dateStr };
                        setMessages(prev => [...prev, newMsg]);
                        if (recipientId) setContacts(prev => prev.map(c => c.id === recipientId ? { ...c, lastMessage: `[${t("file")}] ${metadata.name}`, timestamp: timeStr } : c));
                    }
                }
            }
        };
        wsRef.current = ws;
        return () => ws.close();
    }, [myDeviceId, keyPair, recipientId, t]);

    // Обновление контактов
    useEffect(() => {
        if (!recipientId) return;
        const update = async () => {
            try {
                const [statusRes, nicknameRes] = await Promise.all([fetch(`${SERVER_URL}/status/${recipientId}`), fetch(`${SERVER_URL}/nickname/${recipientId}`)]);
                const statusData = await statusRes.json();
                const nicknameData = await nicknameRes.json();
                setContacts(prev => prev.map(c => c.id === recipientId ? { ...c, online: statusData.online, name: nicknameData.nickname } : c));
            } catch (err) { console.error(err); }
        };
        update();
        const interval = setInterval(update, 3000);
        return () => clearInterval(interval);
    }, [recipientId]);

    const sendTextMessage = async (text: string) => {
        if (!recipientId || !text.trim() || !keyPair) return;
        try {
            const pubRes = await fetch(`${SERVER_URL}/keys/${recipientId}`);
            if (!pubRes.ok) throw new Error("Recipient not found");
            const { publicKey: recipientJwk } = await pubRes.json();
            const recipientPubKey = await importPublicKeyJwk(recipientJwk);
            const encrypted = await encryptMessage(recipientPubKey, text);
            await fetch(`${SERVER_URL}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipientDeviceId: recipientId, encrypted, type: "text" }) });
            const now = new Date();
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateStr = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
            const newMsg: Message = { id: crypto.randomUUID(), senderId: myDeviceId!, type: "text", content: text, time: timeStr, date: dateStr };
            setMessages(prev => [...prev, newMsg]);
            setContacts(prev => prev.map(c => c.id === recipientId ? { ...c, lastMessage: text, timestamp: timeStr } : c));
        } catch (err) { console.error(err); alert(t("sendFailed")); }
    };

    const sendFileMessage = async (file: File) => {
        if (!recipientId || !keyPair) return;
        try {
            const pubRes = await fetch(`${SERVER_URL}/keys/${recipientId}`);
            if (!pubRes.ok) throw new Error("Recipient not found");
            const { publicKey: recipientJwk } = await pubRes.json();
            const recipientPubKey = await importPublicKeyJwk(recipientJwk);
            const fileBuffer = await file.arrayBuffer();
            const localPreviewUrl = URL.createObjectURL(new Blob([fileBuffer], { type: file.type }));
            const encrypted = await encryptFile(recipientPubKey, fileBuffer);
            const metadata = { name: file.name, type: file.type, size: file.size };
            await fetch(`${SERVER_URL}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipientDeviceId: recipientId, encrypted, type: "file", metadata }) });
            const now = new Date();
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateStr = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
            const newMsg: Message = { id: crypto.randomUUID(), senderId: myDeviceId!, type: "file", fileData: { encrypted, metadata }, localPreviewUrl, time: timeStr, date: dateStr };
            setMessages(prev => [...prev, newMsg]);
            setContacts(prev => prev.map(c => c.id === recipientId ? { ...c, lastMessage: `[${t("file")}] ${file.name}`, timestamp: timeStr } : c));
        } catch (err) { console.error(err); alert(t("sendFailed")); }
    };

    const getDecryptedFileData = async (encryptedData: any): Promise<ArrayBuffer> => {
        if (!keyPair) throw new Error("No key pair");
        return await decryptFile(encryptedData, keyPair.privateKey);
    };

    const downloadDecryptedFile = async (encryptedData: any, metadata: any) => {
        const decrypted = await getDecryptedFileData(encryptedData);
        const blob = new Blob([decrypted], { type: metadata.type || "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = metadata.name; document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const addContact = async (id: string) => {
        if (!id.trim() || id === myDeviceId) return;
        if (contacts.some(c => c.id === id)) { setRecipientId(id); setMessages([]); return; }
        try {
            const nicknameRes = await fetch(`${SERVER_URL}/nickname/${id}`);
            const nicknameData = await nicknameRes.json();
            const newContact: Contact = { id, name: nicknameData.nickname || `User ${id.slice(-4)}`, avatar: '', lastMessage: '', timestamp: '', online: false };
            setContacts(prev => [...prev, newContact]); setRecipientId(id); setMessages([]);
        } catch (err) {
            const newContact: Contact = { id, name: `User ${id.slice(-4)}`, avatar: '', lastMessage: '', timestamp: '', online: false };
            setContacts(prev => [...prev, newContact]); setRecipientId(id); setMessages([]);
        }
    };

    const deleteContact = (contactId: string) => {
        setContacts(prev => prev.filter(c => c.id !== contactId));
        if (recipientId === contactId) { setRecipientId(null); setMessages([]); }
    };
    const handleSelectContact = (contactId: string) => { setRecipientId(contactId); setMessages([]); };
    const updateNickname = async (newNickname: string) => {
        if (!myDeviceId || !newNickname.trim()) return;
        try {
            const res = await fetch(`${SERVER_URL}/update-nickname`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId: myDeviceId, nickname: newNickname.trim() }) });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (data.success) setMyNickname(data.nickname);
            else console.error("Failed to update nickname");
        } catch (err) { console.error("Error updating nickname:", err); }
    };

    const currentContact = recipientId ? contacts.find(c => c.id === recipientId) || null : null;
    if (!myDeviceId) return <div className="flex items-center justify-center h-screen">{t("loading")}</div>;

    return (
        <>
            <div className="flex h-screen">
                <div className="w-80 border-r border-border bg-background flex flex-col">
                    <div className="p-4 border-b">
                        <h2 className="font-semibold mb-2">{t("chats")}</h2>
                        <div className="flex gap-2">
                            <input type="text" placeholder={t("enterDeviceIdPlaceholder")} className="flex-1 px-2 py-1 border rounded text-sm" id="contactIdInput" onKeyPress={(e) => { if (e.key === 'Enter') { addContact((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ''; } }} />
                            <button onClick={() => { const input = document.getElementById('contactIdInput') as HTMLInputElement; if (input) addContact(input.value); if (input) input.value = ''; }} className="px-2 py-1 bg-blue-500 text-white rounded text-sm">{t("add")}</button>
                        </div>
                    </div>
                    <ContactsSidebar contacts={contacts} selectedContactId={recipientId} onSelectContact={handleSelectContact} onDeleteContact={deleteContact} t={t} />
                </div>
                <div className="flex-1 flex flex-col min-w-0">
                    <DeviceIdHeader deviceId={myDeviceId} nickname={myNickname} onOpenSettings={() => setIsSettingsOpen(true)} t={t} />
                    {!recipientId ? <div className="flex-1 flex items-center justify-center text-muted-foreground">{t("enterDeviceId")}</div> : <>
                        <ChatArea contact={currentContact} messages={messages} currentUserId={myDeviceId} onDecryptAndDownloadFile={downloadDecryptedFile} onDecryptAndGetFileData={getDecryptedFileData} t={t} />
                        <MessageInput onSendMessage={sendTextMessage} onSendFile={sendFileMessage} disabled={!recipientId} t={t} />
                    </>}
                </div>
            </div>
            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} currentNickname={myNickname} onUpdateNickname={updateNickname} currentTheme={theme} onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')} onToggleLanguage={toggleLanguage} currentLanguage={language} t={t} />
        </>
    );
}

function App() {
    return (
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            <LanguageProvider>
                <AppContent />
            </LanguageProvider>
        </ThemeProvider>
    );
}

export default App;