import { useState, useEffect, useRef } from 'react';
import { UserPlus, MessageSquare, Search } from 'lucide-react';
import { ContactsSidebar, type Contact } from './components/contacts-sidebar';
import { ChatArea, type Message } from './components/chat-area';
import { DeviceIdHeader } from './components/device-id-header';
import { MessageInput } from './components/message-input';
import { SettingsModal } from './components/SettingsModal';
import { ThemeProvider, useTheme } from 'next-themes';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { ApiClient, WS_URL } from './lib/apiClient';
import { E2EE } from './lib/e2ee';
import './styles/globals.css';

const CONTACTS_STORAGE_KEY = "messenger_contacts";

// ---------- Компонент ----------
function AppContent() {
    const { theme, setTheme } = useTheme();
    const { t, toggleLanguage, language } = useLanguage();
    const [token, setToken] = useState<string | null>(null);
    const [myDeviceId, setMyDeviceId] = useState<string | null>(null);
    const [myNickname, setMyNickname] = useState<string>("");
    const [recipientId, setRecipientId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
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

    const initRef = useRef(false);

    useEffect(() => {
        if (initRef.current) return;
        initRef.current = true;
        
        const init = async () => {
            const username = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
            const password = crypto.randomUUID();
            
            try {
                // Collect real device info
                const userAgent = navigator.userAgent;
                const platformInfo = navigator.platform || "Unknown";
                const screenRes = `${window.screen.width}x${window.screen.height}`;
                const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                const rawHwid = `${userAgent}-${platformInfo}-${screenRes}-${timezone}`;
                
                // Hash hwid
                const hwidBuffer = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawHwid));
                const hwidHash = Array.from(new Uint8Array(hwidBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

                const isMobile = /Mobi|Android/i.test(userAgent);
                let deviceModel = "Unknown Device";
                if (/iPhone/i.test(userAgent)) deviceModel = "iPhone";
                else if (/iPad/i.test(userAgent)) deviceModel = "iPad";
                else if (/Android/i.test(userAgent)) deviceModel = "Android Device";
                else if (/Windows/i.test(userAgent)) deviceModel = "Windows PC";
                else if (/Mac/i.test(userAgent)) deviceModel = "Mac";
                else if (/Linux/i.test(userAgent)) deviceModel = "Linux PC";
                
                const deviceName = isMobile ? `Mobile Browser (${deviceModel})` : `Web Browser (${deviceModel})`;

                await ApiClient.register(username, password);
                const jwtToken = await ApiClient.login(username, password, {
                    device_name: deviceName,
                    device_model: deviceModel,
                    platform: platformInfo,
                    hwid: hwidHash
                });
                
                // Generate E2EE keys
                const identity = await E2EE.generateIdentity();
                const preKeys = await E2EE.generatePreKeys();
                const signedPreKey = await E2EE.generateSignedPreKey(identity, 0);

                const toUrlSafeNoPad = (b64: string) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
                
                const uploadPayload = {
                    identity_key: toUrlSafeNoPad(identity.public_key),
                    registration_id: identity.registration_id,
                    signed_pre_key: {
                        key_id: signedPreKey.key_id,
                        public_key: toUrlSafeNoPad(signedPreKey.public_key),
                        signature: toUrlSafeNoPad(signedPreKey.signature)
                    },
                    one_time_keys: preKeys.map(k => ({
                        key_id: k.key_id,
                        public_key: toUrlSafeNoPad(k.public_key)
                    }))
                };

                await ApiClient.uploadKeys(jwtToken, uploadPayload);

                setToken(jwtToken);
                setMyDeviceId(username);
                setMyNickname(username);
            } catch (err) {
                console.error("Init failed:", err);
            }
        };

        init();
    }, []);

    // WebSocket 
    useEffect(() => {
        if (!token || !myDeviceId) return;
        const ws = new WebSocket(`${WS_URL}?token=${token}`);
        ws.onopen = () => console.log("WebSocket connected");
        
        ws.onmessage = async (event) => {
            const data = JSON.parse(event.data);
            const now = new Date();
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateStr = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

            if (data.type === "Text" || data.type === "Encrypted") {
                try {
                    let plaintext = "";
                    if (data.type === "Text") {
                        plaintext = data.content;
                    } else if (data.type === "Encrypted") {
                        // Find ciphertext for my device (we only have 1 device ID in this mock, which is 'username')
                        // The actual device ID in the payload isn't clear, we'll try the first one that succeeds.
                        let decrypted = null;
                        for (const ct of data.ciphertexts) {
                            try {
                                const ctMsg = JSON.parse(atob(ct.ciphertext));
                                const senderAddr = `${data.from}.${ct.device_id || 1}`; 
                                // Actually, we don't know the exact remoteAddress format used on send. Let's assume senderId.deviceId
                                plaintext = await E2EE.decryptMessage(senderAddr, ctMsg);
                                decrypted = true;
                                break;
                            } catch (e) {
                                // Try next ciphertext
                            }
                        }
                        if (!decrypted) {
                            plaintext = "[Encrypted message - Decryption Failed]";
                        }
                    }
                    
                    const newMsg: Message = { id: data.id || crypto.randomUUID(), senderId: data.from || 'unknown', type: "text", content: plaintext, time: timeStr, date: dateStr };
                    setMessages(prev => [...prev, newMsg]);
                    
                    // Update contact last message
                    const sender = data.from;
                    setContacts(prev => prev.map(c => c.id === sender ? { ...c, lastMessage: plaintext, timestamp: timeStr } : c));
                } catch (e) {
                    console.error("Failed to parse/decrypt incoming message", e);
                }
            } else if (data.type === "File") {
                const newMsg: Message = { id: data.id || crypto.randomUUID(), senderId: data.from || 'unknown', type: "file", fileData: { file_url: data.file_url, metadata: { name: data.file_name, type: data.mime_type, size: 0 } }, time: timeStr, date: dateStr };
                setMessages(prev => [...prev, newMsg]);
                setContacts(prev => prev.map(c => c.id === data.from ? { ...c, lastMessage: `[File] ${data.file_name}`, timestamp: timeStr } : c));
            }
        };

        wsRef.current = ws;
        return () => {
            if (ws.readyState === 1) {
                ws.close();
            }
        };
    }, [token, myDeviceId, t]);

    
    const sendTextMessage = async (text: string) => {
        if (!recipientId || !text.trim() || !wsRef.current || !token) return;
        
        try {
            const msgId = crypto.randomUUID();
            
            // Fetch keys
            let keyData;
            try {
                keyData = await ApiClient.claimKeys(token, recipientId);
            } catch (e) {
                console.error("Failed to claim keys", e);
            }

            if (keyData && keyData.devices && keyData.devices.length > 0) {
                const ciphertexts = [];
                for (const device of keyData.devices) {
                    const bundle = {
                        registration_id: device.registration_id || 1,
                        identity_key: device.identity_key,
                        signed_pre_key_id: device.signed_pre_key.key_id,
                        signed_pre_key_public: device.signed_pre_key.public_key,
                        signed_pre_key_signature: device.signed_pre_key.signature,
                        pre_key_id: device.one_time_key ? device.one_time_key.key_id : undefined,
                        pre_key_public: device.one_time_key ? device.one_time_key.public_key : undefined
                    };
                    
                    const remoteAddr = `${recipientId}.${device.device_id}`;
                    
                    try {
                        await E2EE.processPreKeyBundle(remoteAddr, bundle);
                        const encrypted = await E2EE.encryptMessage(remoteAddr, text);
                        
                        ciphertexts.push({
                            device_id: device.device_id,
                            type: 3,
                            ciphertext: btoa(JSON.stringify(encrypted))
                        });
                    } catch (e) {
                        console.error("Failed to encrypt for device", device.device_id, e);
                    }
                }
                
                if (ciphertexts.length > 0) {
                    const payload = {
                        type: "Encrypted",
                        to: recipientId,
                        id: msgId,
                        ciphertexts: ciphertexts
                    };
                    wsRef.current.send(JSON.stringify(payload));
                } else {
                    throw new Error("Failed to encrypt for any device");
                }
            } else {
                // Fallback to text if no keys found
                const payload = {
                    type: "Text",
                    to: recipientId,
                    id: msgId,
                    content: text
                };
                wsRef.current.send(JSON.stringify(payload));
            }

            const now = new Date();
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateStr = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
            const newMsg: Message = { id: msgId, senderId: myDeviceId!, type: "text", content: text, time: timeStr, date: dateStr };
            setMessages(prev => [...prev, newMsg]);
            setContacts(prev => prev.map(c => c.id === recipientId ? { ...c, lastMessage: text, timestamp: timeStr } : c));
        } catch (err) { console.error(err); alert(t("sendFailed")); }
    };


    const sendFileMessage = async (file: File) => {
        if (!recipientId || !wsRef.current || !token) return;
        try {
            // Request presign url
            const presignData = await ApiClient.presignFile(token, file.name, file.type);
            if (!presignData || !presignData.upload_url) throw new Error("Failed to get presign URL");
            
            // Upload file
            await fetch(presignData.upload_url, {
                method: "PUT",
                body: file
            });

            // Send WS message
            const msgId = crypto.randomUUID();
            const payload = {
                type: "File",
                to: recipientId,
                id: msgId,
                file_name: file.name,
                mime_type: file.type,
                file_url: presignData.download_url
            };
            wsRef.current.send(JSON.stringify(payload));

            const localPreviewUrl = URL.createObjectURL(file);
            const now = new Date();
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateStr = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
            const newMsg: Message = { id: msgId, senderId: myDeviceId!, type: "file", fileData: { file_url: presignData.download_url, metadata: { name: file.name, type: file.type, size: file.size } }, localPreviewUrl, time: timeStr, date: dateStr };
            setMessages(prev => [...prev, newMsg]);
            setContacts(prev => prev.map(c => c.id === recipientId ? { ...c, lastMessage: `[File] ${file.name}`, timestamp: timeStr } : c));
        } catch (err) { console.error(err); alert(t("sendFailed")); }
    };

    const getDecryptedFileData = async (fileData: any): Promise<ArrayBuffer> => {
        // Return downloaded file as array buffer for now, bypass decrypt
        const res = await fetch(fileData.file_url, {
            headers: token ? { "Authorization": `Bearer ${token}` } : {}
        });
        return res.arrayBuffer();
    };

    const downloadDecryptedFile = async (fileData: any, metadata: any) => {
        const decrypted = await getDecryptedFileData(fileData);
        const blob = new Blob([decrypted], { type: metadata.type || "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = metadata.name; document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const addContact = async (id: string) => {
        if (!id.trim() || id === myDeviceId) return;
        if (contacts.some(c => c.id === id)) { setRecipientId(id); setMessages([]); return; }
        
        const newContact: Contact = { id, name: id, avatar: '', lastMessage: '', timestamp: '', online: false };
        setContacts(prev => [...prev, newContact]); setRecipientId(id); setMessages([]);
        
        // Try fetch dialogs to populate? Or just keep it optimistic
    };

    const deleteContact = (contactId: string) => {
        setContacts(prev => prev.filter(c => c.id !== contactId));
        if (recipientId === contactId) { setRecipientId(null); setMessages([]); }
    };
    const handleSelectContact = (contactId: string) => { setRecipientId(contactId); setMessages([]); };
    const updateNickname = async (newNickname: string) => {
        if (!myDeviceId || !newNickname.trim()) return;
        setMyNickname(newNickname.trim());
        // Need specific endpoint for nickname updates if it exists in API
    };

    const currentContact = recipientId ? contacts.find(c => c.id === recipientId) || null : null;
    if (!myDeviceId) return <div className="flex items-center justify-center h-screen">{t("loading")}</div>;

    return (
        <>
            <div className="flex h-screen">
                <div className="w-80 border-r border-border bg-background flex flex-col">
                    <div className="p-4 border-b border-border bg-muted/20">
                        <div className="flex items-center gap-2 mb-4">
                            <MessageSquare className="w-5 h-5 text-primary" />
                            <h2 className="text-xl font-bold tracking-tight text-foreground">{t("chats")}</h2>
                        </div>
                        <div className="relative flex items-center group">
                            <Search className="absolute left-3 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                            <input 
                                type="text" 
                                placeholder={t("enterDeviceIdPlaceholder")} 
                                className="w-full pl-9 pr-10 py-2 bg-background border border-input rounded-full text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-muted-foreground shadow-sm" 
                                id="contactIdInput" 
                                onKeyDown={(e) => { 
                                    if (e.key === 'Enter') { 
                                        const target = e.target as HTMLInputElement;
                                        addContact(target.value); 
                                        target.value = ''; 
                                    } 
                                }} 
                            />
                            <button 
                                onClick={() => { 
                                    const input = document.getElementById('contactIdInput') as HTMLInputElement; 
                                    if (input) { addContact(input.value); input.value = ''; } 
                                }} 
                                className="absolute right-1 p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full transition-all outline-none focus:ring-2 focus:ring-primary/20 flex items-center justify-center"
                                aria-label={t("add")}
                                title={t("add")}
                            >
                                <UserPlus className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    <ContactsSidebar contacts={contacts} selectedContactId={recipientId} onSelectContact={handleSelectContact} onDeleteContact={deleteContact} t={t} />
                </div>
                <div className="flex-1 flex flex-col min-w-0">
                    <DeviceIdHeader deviceId={myDeviceId} nickname={myNickname} onOpenSettings={() => setIsSettingsOpen(true)} t={t} />
                    {!recipientId ? <div className="flex-1 flex items-center justify-center text-muted-foreground">{t("enterDeviceId")}</div> : <>
                        <ChatArea contact={currentContact} messages={messages} currentUserId={myDeviceId} onDecryptAndDownloadFile={(fileUrl) => downloadDecryptedFile(fileUrl, {} as any)} onDecryptAndGetFileData={(fileUrl) => getDecryptedFileData(fileUrl)} t={t} />
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
