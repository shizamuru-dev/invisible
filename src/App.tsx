import { useState, useEffect, useRef } from 'react';
import { ContactsSidebar } from './components/contacts-sidebar';
import { ChatArea } from './components/chat-area';
import { DeviceIdHeader } from './components/device-id-header';
import { MessageInput } from './components/message-input';
import { SettingsModal } from './components/SettingsModal';
import { ThemeProvider, useTheme } from 'next-themes';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { MyServerApi } from './lib/apiClient';
import './styles/globals.css';

// const SERVER_URL = "http://localhost:5001"; // используется в fetch для статусов (но можно закомментировать, если не нужно)

async function compressImage(file: File, maxSizeMB = 0.5): Promise<string> {
    // ... (без изменений, как было)
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const maxDim = 512;
                if (width > height && width > maxDim) {
                    height = (height * maxDim) / width;
                    width = maxDim;
                } else if (height > maxDim) {
                    width = (width * maxDim) / height;
                    height = maxDim;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                const compressed = canvas.toDataURL('image/jpeg', 0.7);
                if (compressed.length > maxSizeMB * 1024 * 1024) {
                    reject(new Error(`Avatar too large after compression`));
                } else {
                    resolve(compressed);
                }
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
}

// ---------- Криптографические функции (без изменений) ----------
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
async function decryptMessage(encryptedPackage: any, privateKey: CryptoKey): Promise<string> {
    const ephemeralPublic = await importPublicKeyJwk(encryptedPackage.ephemeralPublicKey);
    const sharedSecret = await window.crypto.subtle.deriveBits(
        { name: "ECDH", public: ephemeralPublic },
        privateKey,
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

// ---------- Экран приветствия (без изменений) ----------
function WelcomeScreen({ onStart }: { onStart: () => void }) {
    const { t } = useLanguage();
    const quotes = [
        { text: "Торт — это ложь.", source: "Portal 2, GLaDOS" },
        { text: "Вы бы не могли подписать мою петицию?", source: "Postal 2, Dude" },
        { text: "Жить или не жить?", source: "Шекспир, «Гамлет»" },
        { text: "Я не в настроении умирать сегодня.", source: "Властелин колец, Арагорн" },
        { text: "Война не меняется.", source: "Fallout, рассказчик" },
        { text: "Время приключений!", source: "Adventure Time, Джейк" },
    ];
    const [quote, setQuote] = useState(quotes[0]);
    useEffect(() => {
        const randomIndex = Math.floor(Math.random() * quotes.length);
        setQuote(quotes[randomIndex]);
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm shadow-2xl shadow-blue-500/10 dark:shadow-indigo-500/20 transition-all duration-300 hover:shadow-blue-500/20 dark:hover:shadow-indigo-500/30">
                <div className="p-8">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                            Invisible
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">
                            {t("welcomeSubtitle")}
                        </p>
                    </div>
                    <button
                        onClick={onStart}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold hover:opacity-90 transition-all"
                    >
                        {t("start")}
                    </button>
                </div>
            </div>
            <div className="mt-8 text-center max-w-md animate-fadeIn">
                <div className="inline-block bg-muted/50 rounded-xl px-5 py-3 shadow-sm transition-all">
                    <p className="text-foreground text-base italic font-medium">
                        «{quote.text}»
                    </p>
                    <p className="text-muted-foreground text-xs mt-1">
                        — {quote.source}
                    </p>
                </div>
            </div>
        </div>
    );
}

// ---------- Основной компонент чата ----------
function MyServerChat({ onSwitchMode }: { onSwitchMode: () => void }) {
    const { theme, setTheme } = useTheme();
    const { t, toggleLanguage, language } = useLanguage();

    // Состояния
    const [myDeviceId, setMyDeviceId] = useState<string | null>(null);
    const [myNickname, setMyNickname] = useState<string>('');
    const [myAvatar, setMyAvatar] = useState<string | null>(null);
    const [recipientId, setRecipientId] = useState<string | null>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [keyPair, setKeyPair] = useState<CryptoKeyPair | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const [contacts, setContacts] = useState<any[]>([]);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [contactInput, setContactInput] = useState('');
    const [blockedList, setBlockedList] = useState<string[]>([]);
    const [isInitialized, setIsInitialized] = useState(false);
    const [contactActions, setContactActions] = useState<Record<string, string>>({});

    // Защита от двойной отправки через state (блокирует UI)
    const [isSendingText, setIsSendingText] = useState(false);
    const [isSendingFile, setIsSendingFile] = useState(false);

    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Загрузка контактов
    useEffect(() => {
        const stored = localStorage.getItem("contacts");
        if (stored) {
            const parsed = JSON.parse(stored);
            Promise.all(parsed.map(async (c: any) => {
                try {
                    const data = await MyServerApi.getNickname(c.id);
                    return { ...c, name: data.nickname, avatar: data.avatar };
                } catch {
                    return c;
                }
            })).then(updated => setContacts(updated));
        }
    }, []);

    useEffect(() => {
        if (contacts.length > 0) {
            localStorage.setItem("contacts", JSON.stringify(contacts.map(({ id, name, avatar, lastMessage, timestamp, online }) => ({ id, name, avatar, lastMessage, timestamp, online }))));
        }
    }, [contacts]);

    const startRegistration = async () => {
        const kp = await generateKeyPair();
        setKeyPair(kp);
        const publicJwk = await exportPublicKeyJwk(kp.publicKey);
        const data = await MyServerApi.register(publicJwk);
        setMyDeviceId(data.deviceId);
        setMyNickname(data.nickname);
        const profile = await MyServerApi.getNickname(data.deviceId);
        setMyAvatar(profile.avatar);
        try {
            const blockedData = await MyServerApi.getBlocked(data.deviceId);
            setBlockedList(blockedData.blocked);
        } catch (err) { console.error(err); }
        setIsInitialized(true);
    };

    // Функция отправки action через WebSocket
    const sendAction = (action: string, recipient: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.log(`[sendAction] WebSocket not open, state: ${wsRef.current?.readyState}`);
        return;
    }
    wsRef.current.send(JSON.stringify({
        type: 'action',
        recipientId: recipient,
        action: action
    }));
    console.log(`[sendAction] sent ${action} to ${recipient}`);
};

    // Обработка входящих action
    const handleAction = (from: string, action: string) => {
    console.log(`[handleAction] from ${from}: ${action}`);
    if (contacts.some(c => c.id === from)) {
        setContactActions(prev => ({ ...prev, [from]: action }));
        setTimeout(() => {
            setContactActions(prev => {
                if (prev[from] === action) {
                    const newState = { ...prev };
                    delete newState[from];
                    return newState;
                }
                return prev;
            });
        }, 3000);
    }
};

    // WebSocket соединение
    useEffect(() => {
        if (!myDeviceId || !keyPair) return;
        let retryCount = 0;
        let ws: WebSocket | null = null;
        const connect = () => {
            ws = new WebSocket(`ws://localhost:5001/ws?deviceId=${myDeviceId}`);
            ws.onopen = () => console.log("WebSocket connected");
            ws.onmessage = async (event) => {
                const data = JSON.parse(event.data);
                if (data.type === "new_message") {
                    const messageData = await MyServerApi.getMessage(data.messageId);
                    const { encrypted, type, metadata, from } = messageData;
                    const now = new Date();
                    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const dateStr = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
                    if (type === "text") {
                        if (!keyPair) return;
                        const plaintext = await decryptMessage(encrypted, keyPair.privateKey);
                        const newMsg = { id: data.messageId, senderId: from, type: "text", content: plaintext, time: timeStr, date: dateStr };
                        setMessages(prev => [...prev, newMsg]);
                        setContacts(prev => prev.map((c: any) => c.id === from ? { ...c, lastMessage: plaintext, timestamp: timeStr } : c));
                    } else if (type === "file") {
                        const newMsg = { id: data.messageId, senderId: from, type: "file", fileData: { encrypted, metadata }, time: timeStr, date: dateStr };
                        setMessages(prev => [...prev, newMsg]);
                        setContacts(prev => prev.map((c: any) => c.id === from ? { ...c, lastMessage: `[Файл] ${metadata.name}`, timestamp: timeStr } : c));
                    }
                } else if (data.type === "action") {
    console.log("[WS] Received action:", data);
    handleAction(data.from, data.action);
}
            };
            ws.onclose = () => {
                console.log("WebSocket closed, reconnecting...");
                setTimeout(() => {
                    if (retryCount < 10) connect();
                    retryCount++;
                }, 5000);
            };
            wsRef.current = ws;
        };
        connect();
        return () => ws?.close();
    }, [myDeviceId, keyPair]);

    // Отправка статуса "печатает"
    const handleTyping = (_text: string) => { // параметр переименован, чтобы не было warning
        if (!recipientId) return;
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        sendAction('typing', recipientId);
        typingTimeoutRef.current = setTimeout(() => {}, 2000);
    };

    const sendTextMessage = async (text: string) => {
        if (!recipientId || !text.trim() || !keyPair) return;
        if (!myDeviceId) return;
        if (isSendingText) return;
        setIsSendingText(true);
        try {
            const { publicKey: recipientJwk } = await MyServerApi.getPublicKey(recipientId);
            const recipientPubKey = await importPublicKeyJwk(recipientJwk);
            const encrypted = await encryptMessage(recipientPubKey, text);
            await MyServerApi.sendMessage(recipientId, encrypted, null, myDeviceId);
            const now = new Date();
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateStr = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
            const newMsg = { id: Date.now().toString(), senderId: myDeviceId, type: "text", content: text, time: timeStr, date: dateStr };
            setMessages(prev => [...prev, newMsg]);
            setContacts(prev => prev.map((c: any) => c.id === recipientId ? { ...c, lastMessage: text, timestamp: timeStr } : c));
        } catch (err) { console.error(err); alert("Send failed"); }
        finally {
            setIsSendingText(false);
        }
    };

    const decryptFileData = async (encryptedData: any): Promise<ArrayBuffer> => {
        if (!keyPair) throw new Error("No key pair");
        if (encryptedData.unencrypted) {
            console.log("File is unencrypted, returning raw data");
            return new Uint8Array(encryptedData.ciphertext).buffer;
        }
        if (!encryptedData.ciphertext || encryptedData.ciphertext.length === 0) {
            throw new Error("Ciphertext is empty");
        }
        const ephemeralPublic = await importPublicKeyJwk(encryptedData.ephemeralPublicKey);
        const sharedSecret = await window.crypto.subtle.deriveBits(
            { name: "ECDH", public: ephemeralPublic },
            keyPair.privateKey,
            256
        );
        const aesKey = await window.crypto.subtle.importKey(
            "raw", sharedSecret,
            { name: "AES-GCM" },
            false,
            ["decrypt"]
        );
        const iv = new Uint8Array(encryptedData.iv || []);
        const ciphertext = new Uint8Array(encryptedData.ciphertext);
        const decrypted = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            aesKey,
            ciphertext
        );
        return decrypted;
    };

    const downloadDecryptedFile = async (encryptedData: any, metadata: any) => {
        const decryptedBuffer = await decryptFileData(encryptedData);
        const blob = new Blob([decryptedBuffer], { type: metadata.type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = metadata.name;
        a.click();
        URL.revokeObjectURL(url);
    };

    const sendFileMessage = async (file: File) => {
        if (!recipientId || !keyPair) return;
        if (!myDeviceId) return;
        if (isSendingFile) return;
        setIsSendingFile(true);
        sendAction('uploading', recipientId);
        const MAX_SIZE = 10 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            alert("File too large. Maximum 10 MB.");
            setIsSendingFile(false);
            return;
        }
        try {
            const { publicKey: recipientJwk } = await MyServerApi.getPublicKey(recipientId);
            const recipientPubKey = await importPublicKeyJwk(recipientJwk);
            let encrypted, metadata;
            if (file.type.startsWith('audio/')) {
                const fileBuffer = await file.arrayBuffer();
                encrypted = { ciphertext: Array.from(new Uint8Array(fileBuffer)), iv: [], ephemeralPublicKey: {}, unencrypted: true };
                metadata = { name: file.name, type: file.type, size: file.size, unencrypted: true };
            } else {
                const fileBuffer = await file.arrayBuffer();
                encrypted = await encryptFile(recipientPubKey, fileBuffer);
                metadata = { name: file.name, type: file.type, size: file.size };
            }
            await MyServerApi.sendMessage(recipientId, encrypted, metadata, myDeviceId);
            const now = new Date();
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateStr = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
            const localPreviewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
            const newMsg = {
                id: Date.now().toString(),
                senderId: myDeviceId,
                type: "file",
                fileData: { encrypted, metadata },
                localPreviewUrl,
                time: timeStr,
                date: dateStr,
            };
            setMessages(prev => [...prev, newMsg]);
            setContacts(prev => prev.map((c: any) => c.id === recipientId ? { ...c, lastMessage: `📎 ${file.name}`, timestamp: timeStr } : c));
        } catch (err) { console.error(err); alert("Send failed"); }
        finally {
            setIsSendingFile(false);
        }
    };

    const addContact = async (id: string) => {
        if (!id.trim() || id === myDeviceId) return;
        if (contacts.some((c: any) => c.id === id)) { setRecipientId(id); setContactInput(''); return; }
        try {
            const { nickname, avatar } = await MyServerApi.getNickname(id);
            const newContact = { id, name: nickname || `User ${id.slice(-4)}`, avatar: avatar || '', lastMessage: '', timestamp: '', online: false };
            setContacts(prev => [...prev, newContact]);
            setRecipientId(id);
            setContactInput('');
        } catch {
            const newContact = { id, name: `User ${id.slice(-4)}`, avatar: '', lastMessage: '', timestamp: '', online: false };
            setContacts(prev => [...prev, newContact]);
            setRecipientId(id);
            setContactInput('');
        }
    };

    const deleteContact = (contactId: string) => {
        setContacts(prev => prev.filter((c: any) => c.id !== contactId));
        if (recipientId === contactId) setRecipientId(null);
    };
    const handleSelectContact = (contactId: string) => setRecipientId(contactId);
    const updateNickname = async (newNickname: string) => {
        if (!myDeviceId || !newNickname.trim()) return;
        try {
            await MyServerApi.updateNickname(myDeviceId, newNickname);
            setMyNickname(newNickname);
        } catch (err) { console.error(err); }
    };
    const updateAvatar = async (newAvatar: string) => {
        if (!myDeviceId) return;
        try {
            await MyServerApi.updateAvatar(myDeviceId, newAvatar);
            setMyAvatar(newAvatar);
        } catch (err) { console.error(err); }
    };
    const handleLogout = () => {
        localStorage.clear();
        setMyDeviceId(null);
        setKeyPair(null);
        setContacts([]);
        setMessages([]);
        setMyAvatar(null);
        setBlockedList([]);
        setRecipientId(null);
        setIsInitialized(false);
        onSwitchMode();
    };
    const blockContact = async (contactId: string) => {
        try {
            await MyServerApi.block(myDeviceId!, contactId);
            setBlockedList(prev => [...prev, contactId]);
            setContacts(prev => prev.filter((c: any) => c.id !== contactId));
            if (recipientId === contactId) setRecipientId(null);
        } catch (err) { console.error(err); }
    };
    const unblockContact = async (contactId: string) => {
        try {
            await MyServerApi.unblock(myDeviceId!, contactId);
            setBlockedList(prev => prev.filter(id => id !== contactId));
        } catch (err) { console.error(err); }
    };

    const currentContact = recipientId ? contacts.find((c: any) => c.id === recipientId) || null : null;
    const currentAction = recipientId ? contactActions[recipientId] : null;

    if (!isInitialized && !myDeviceId) {
        return <WelcomeScreen onStart={startRegistration} />;
    }

    const isInputDisabled = !recipientId || isSendingText || isSendingFile;

    return (
        <>
            <div className="flex h-screen">
                <div className="w-80 border-r border-border bg-background flex flex-col">
                    <div className="p-4 border-b">
                        <h2 className="font-semibold mb-2">{t("chats")}</h2>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={contactInput}
                                onChange={(e) => setContactInput(e.target.value)}
                                placeholder={t("enterDeviceIdPlaceholder")}
                                className="flex-1 px-2 py-1 border rounded text-sm"
                                onKeyPress={(e) => { if (e.key === 'Enter') addContact(contactInput); }}
                            />
                            <button onClick={() => addContact(contactInput)} className="px-2 py-1 bg-blue-500 text-white rounded text-sm">
                                {t("add")}
                            </button>
                        </div>
                    </div>
                    <ContactsSidebar
                        contacts={contacts}
                        selectedContactId={recipientId}
                        onSelectContact={handleSelectContact}
                        onDeleteContact={deleteContact}
                        onBlockContact={blockContact}
                        t={t}
                        contactActions={contactActions}
                    />
                </div>
                <div className="flex-1 flex flex-col min-w-0">
                    <DeviceIdHeader deviceId={myDeviceId!} nickname={myNickname} avatar={myAvatar} onOpenSettings={() => setIsSettingsOpen(true)} t={t} />
                    {!recipientId ? <div className="flex-1 flex items-center justify-center text-muted-foreground">{t("enterDeviceId")}</div> : <>
                        <ChatArea 
                            contact={{ ...currentContact, action: currentAction }} 
                            messages={messages} 
                            currentUserId={myDeviceId!} 
                            onDecryptAndDownloadFile={downloadDecryptedFile} 
                            onDecryptAndGetFileData={decryptFileData} 
                            t={t} 
                        />
                        <MessageInput 
                            onSendMessage={sendTextMessage} 
                            onSendFile={sendFileMessage} 
                            onTyping={handleTyping}
                            disabled={isInputDisabled} 
                            t={t} 
                        />
                    </>}
                </div>
            </div>
            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                currentNickname={myNickname}
                onUpdateNickname={updateNickname}
                currentTheme={theme}
                onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                onToggleLanguage={toggleLanguage}
                currentLanguage={language}
                onLogout={handleLogout}
                avatar={myAvatar}
                onAvatarChange={updateAvatar}
                blockedList={blockedList}
                onUnblock={unblockContact}
                onSwitchMode={onSwitchMode}
                t={t}
                compressImage={compressImage}
            />
        </>
    );
}

// ---------- Компонент выбора режима ----------
function ModeSelector({ onSelect }: { onSelect: (mode: 'my' | 'colleague') => void }) {
    const { t } = useLanguage();
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 text-center max-w-md w-full">
                <h2 className="text-2xl font-bold mb-6">{t("selectAuthMode")}</h2>
                <div className="flex flex-col gap-4">
                    <button
                        onClick={() => onSelect('my')}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold hover:opacity-90 transition-all"
                    >
                        {t("myServer")}
                    </button>
                    <button
                        onClick={() => onSelect('colleague')}
                        className="w-full py-3 rounded-xl border border-blue-600 text-blue-600 dark:text-blue-400 font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all"
                    >
                        {t("colleagueServer")}
                    </button>
                </div>
            </div>
        </div>
    );
}

function ColleagueChat({ username, onSwitchMode }: { username: string; onSwitchMode: () => void }) {
    const { t } = useLanguage();
    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        onSwitchMode();
    };
    return (
        <div className="flex items-center justify-center h-screen">
            <div className="text-center">
                <h2 className="text-xl mb-4">Чат сервера коллеги</h2>
                <p className="mb-4">Вы вошли как {username}</p>
                <button onClick={handleLogout} className="px-4 py-2 bg-red-500 text-white rounded">
                    {t("logout")}
                </button>
                <button onClick={onSwitchMode} className="ml-2 px-4 py-2 bg-blue-500 text-white rounded">
                    {t("switchMode")}
                </button>
            </div>
        </div>
    );
}

function App() {
    const [authMode, setAuthMode] = useState<'my' | 'colleague' | null>(() => {
        const saved = localStorage.getItem('authMode');
        return saved === 'my' || saved === 'colleague' ? saved : null;
    });
    const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
    const [username, setUsername] = useState<string | null>(() => localStorage.getItem('username'));

    const resetMode = () => {
        localStorage.removeItem('authMode');
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        setAuthMode(null);
        setToken(null);
        setUsername(null);
    };

    if (!authMode) {
        return (
            <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
                <LanguageProvider>
                    <ModeSelector onSelect={(mode) => {
                        localStorage.setItem('authMode', mode);
                        setAuthMode(mode);
                    }} />
                </LanguageProvider>
            </ThemeProvider>
        );
    }

    if (authMode === 'my') {
        return (
            <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
                <LanguageProvider>
                    <MyServerChat onSwitchMode={resetMode} />
                </LanguageProvider>
            </ThemeProvider>
        );
    }

    if (!token || !username) {
        return (
            <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
                <LanguageProvider>
                    <div className="min-h-screen flex items-center justify-center">
                        <div className="text-center">
                            <p>Для входа на сервер коллеги требуется реализовать компонент Auth</p>
                            <button onClick={resetMode} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">Назад</button>
                        </div>
                    </div>
                </LanguageProvider>
            </ThemeProvider>
        );
    }

    return (
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            <LanguageProvider>
                <ColleagueChat username={username} onSwitchMode={resetMode} />
            </LanguageProvider>
        </ThemeProvider>
    );
}

export default App;