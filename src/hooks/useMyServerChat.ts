import { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { useLanguage } from '../contexts/LanguageContext';
import { STORAGE_KEYS } from '../lib/constants';
import { MyServerApi } from '../lib/apiClient';
import { 
    generateKeyPair, 
    exportPublicKeyJwk, 
    importPublicKeyJwk, 
    exportPrivateKeyJwk, 
    importPrivateKeyJwk, 
    encryptMessage, 
    decryptMessage, 
    encryptFile, 
    base64ToArrayBuffer, 
    arrayBufferToBase64, 
    EncryptedPackage,
    encryptBackup,
    decryptBackup
} from '../lib/crypto';

export interface Contact {
    id: string;
    name: string;
    avatar: string;
    lastMessage: string;
    timestamp: string;
    online: boolean;
    action?: string | null;
}

export interface Message {
    id: string;
    senderId: string;
    type: 'text' | 'file';
    content?: string;
    fileData?: {
        encrypted?: EncryptedPackage;
        metadata: {
            name: string;
            type: string;
            size: number;
        };
        file_url?: string;
    };
    localPreviewUrl?: string;
    time: string;
    date: string;
}

export function useMyServerChat(onSwitchMode: () => void) {
    const { theme, setTheme } = useTheme();
    const { t, toggleLanguage, language } = useLanguage();

    const [myDeviceId, setMyDeviceId] = useState<string | null>(null);
    const [myNickname, setMyNickname] = useState<string>('');
    const [myAvatar, setMyAvatar] = useState<string | null>(null);
    const [recipientId, setRecipientId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [keyPair, setKeyPair] = useState<CryptoKeyPair | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [contactInput, setContactInput] = useState('');
    const [blockedList, setBlockedList] = useState<string[]>([]);
    const [isInitialized, setIsInitialized] = useState(false);
    const [contactActions, setContactActions] = useState<Record<string, string>>({});

    const [isSendingText, setIsSendingText] = useState(false);
    const [isSendingFile, setIsSendingFile] = useState(false);

    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEYS.CONTACTS);
        if (stored) {
            const parsed = JSON.parse(stored);
            Promise.all(parsed.map(async (c: Contact) => {
                try {
                    const data = await MyServerApi.getNickname(c.id);
                    return { ...c, name: data.nickname, avatar: data.avatar };
                } catch {
                    return c;
                }
            })).then(updated => setContacts(updated));
        }

        const initFromStorage = async () => {
            const storedDeviceId = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
            const storedPrivateKey = localStorage.getItem(STORAGE_KEYS.PRIVATE_KEY);
            const storedPublicKey = localStorage.getItem(STORAGE_KEYS.PUBLIC_KEY);

            if (storedDeviceId && storedPrivateKey && storedPublicKey) {
                try {
                    const privateJwk = JSON.parse(storedPrivateKey);
                    const publicJwk = JSON.parse(storedPublicKey);
                    const privateKey = await importPrivateKeyJwk(privateJwk);
                    const publicKey = await importPublicKeyJwk(publicJwk);
                    setKeyPair({ privateKey, publicKey });
                    setMyDeviceId(storedDeviceId);

                    const profile = await MyServerApi.getNickname(storedDeviceId);
                    setMyNickname(profile.nickname);
                    setMyAvatar(profile.avatar);

                    try {
                        const blockedData = await MyServerApi.getBlocked(storedDeviceId);
                        setBlockedList(blockedData.blocked);
                    } catch (err) { console.error(err); }

                    setIsInitialized(true);
                } catch (err) {
                    console.error("Failed to restore keys from storage", err);
                    localStorage.removeItem(STORAGE_KEYS.DEVICE_ID);
                    localStorage.removeItem(STORAGE_KEYS.PRIVATE_KEY);
                    localStorage.removeItem(STORAGE_KEYS.PUBLIC_KEY);
                }
            }
        };
        initFromStorage();
    }, []);

    useEffect(() => {
        if (contacts.length > 0) {
            localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(contacts.map(({ id, name, avatar, lastMessage, timestamp, online }) => ({ id, name, avatar, lastMessage, timestamp, online }))));
        }
    }, [contacts]);

    const startRegistration = async () => {
        try {
            const kp = await generateKeyPair();
            setKeyPair(kp);
            const publicJwk = await exportPublicKeyJwk(kp.publicKey);
            const privateJwk = await exportPrivateKeyJwk(kp.privateKey);
            
            const data = await MyServerApi.register(publicJwk);
            setMyDeviceId(data.deviceId);
            setMyNickname(data.nickname);
            
            localStorage.setItem(STORAGE_KEYS.DEVICE_ID, data.deviceId);
            localStorage.setItem(STORAGE_KEYS.PRIVATE_KEY, JSON.stringify(privateJwk));
            localStorage.setItem(STORAGE_KEYS.PUBLIC_KEY, JSON.stringify(publicJwk));

            const profile = await MyServerApi.getNickname(data.deviceId);
            setMyAvatar(profile.avatar);
            try {
                const blockedData = await MyServerApi.getBlocked(data.deviceId);
                setBlockedList(blockedData.blocked);
            } catch (err) { console.error(err); }
            setIsInitialized(true);
        } catch (err) {
            console.error("Registration failed", err);
            alert("Registration failed");
        }
    };

    const sendAction = useCallback((action: string, recipient: string) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            return;
        }
        wsRef.current.send(JSON.stringify({
            type: 'action',
            recipientId: recipient,
            action: action
        }));
    }, []);

    const handleAction = useCallback((from: string, action: string) => {
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
    }, [contacts]);

    useEffect(() => {
        if (!myDeviceId || !keyPair) return;
        let retryCount = 0;
        let ws: WebSocket | null = null;
        const connect = () => {
            const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:5001";
            ws = new WebSocket(`${WS_URL}/ws?deviceId=${myDeviceId}`);
            ws.onopen = () => {
                console.log("WebSocket connected");
                retryCount = 0;
            };
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
                        const newMsg = { id: data.messageId, senderId: from, type: "text" as const, content: plaintext, time: timeStr, date: dateStr };
                        setMessages(prev => [...prev, newMsg]);
                        setContacts(prev => prev.map((c: Contact) => c.id === from ? { ...c, lastMessage: plaintext, timestamp: timeStr } : c));
                    } else if (type === "file") {
                        const newMsg: Message = { id: data.messageId, senderId: from, type: "file" as const, fileData: { encrypted, metadata: metadata || { name: 'unknown', type: 'application/octet-stream', size: 0 } }, time: timeStr, date: dateStr };
                        setMessages(prev => [...prev, newMsg]);
                        setContacts(prev => prev.map((c: Contact) => c.id === from ? { ...c, lastMessage: `[Файл] ${metadata?.name || 'unknown'}`, timestamp: timeStr } : c));
                    }
                } else if (data.type === "action") {
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
    }, [myDeviceId, keyPair, handleAction]);

    const handleTyping = useCallback((_text: string) => {
        if (!recipientId) return;
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        sendAction('typing', recipientId);
        typingTimeoutRef.current = setTimeout(() => {}, 2000);
    }, [recipientId, sendAction]);

    const sendTextMessage = useCallback(async (text: string) => {
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
            const newMsg = { id: Date.now().toString(), senderId: myDeviceId, type: "text" as const, content: text, time: timeStr, date: dateStr };
            setMessages(prev => [...prev, newMsg]);
            setContacts(prev => prev.map((c: Contact) => c.id === recipientId ? { ...c, lastMessage: text, timestamp: timeStr } : c));
        } catch (err) { console.error(err); alert("Send failed"); }
        finally {
            setIsSendingText(false);
        }
    }, [recipientId, keyPair, myDeviceId, isSendingText]);

    const decryptFileData = async (encryptedData: EncryptedPackage): Promise<ArrayBuffer> => {
        if (!keyPair) throw new Error("No key pair");
        if (encryptedData.unencrypted) {
            return typeof encryptedData.ciphertext === "string"
                ? base64ToArrayBuffer(encryptedData.ciphertext)
                : new Uint8Array(encryptedData.ciphertext as unknown as ArrayBuffer).buffer;
        }
        if (!encryptedData.ciphertext || encryptedData.ciphertext.length === 0) {
            throw new Error("Ciphertext is empty");
        }
        const ephemeralPublic = await importPublicKeyJwk(encryptedData.ephemeralPublicKey!);
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
        const ciphertext = typeof encryptedData.ciphertext === "string" 
            ? base64ToArrayBuffer(encryptedData.ciphertext)
            : new Uint8Array(encryptedData.ciphertext as unknown as ArrayBuffer);
        const decrypted = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            aesKey,
            ciphertext
        );
        return decrypted;
    };

    const downloadDecryptedFile = async (encryptedData: EncryptedPackage, metadata: { name: string, type: string, size: number, unencrypted?: boolean }) => {
        const decryptedBuffer = await decryptFileData(encryptedData);
        const blob = new Blob([decryptedBuffer], { type: metadata.type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = metadata.name;
        a.click();
        URL.revokeObjectURL(url);
    };

    const sendFileMessage = useCallback(async (file: File) => {
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
                encrypted = { ciphertext: arrayBufferToBase64(fileBuffer), iv: [], ephemeralPublicKey: {} as any, unencrypted: true };
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
            const localPreviewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
            const newMsg = {
                id: Date.now().toString(),
                senderId: myDeviceId,
                type: "file" as const,
                fileData: { encrypted, metadata },
                localPreviewUrl,
                time: timeStr,
                date: dateStr,
            };
            setMessages(prev => [...prev, newMsg]);
            setContacts(prev => prev.map((c: Contact) => c.id === recipientId ? { ...c, lastMessage: `📎 ${file.name}`, timestamp: timeStr } : c));
        } catch (err) { console.error(err); alert("Send failed"); }
        finally {
            setIsSendingFile(false);
        }
    }, [recipientId, keyPair, myDeviceId, isSendingFile, sendAction]);

    const addContact = async (id: string) => {
        if (!id.trim() || id === myDeviceId) return;
        if (contacts.some((c: Contact) => c.id === id)) { setRecipientId(id); setContactInput(''); return; }
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
        setContacts(prev => prev.filter((c: Contact) => c.id !== contactId));
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
            setContacts(prev => prev.filter((c: Contact) => c.id !== contactId));
            if (recipientId === contactId) setRecipientId(null);
        } catch (err) { console.error(err); }
    };
    
    const unblockContact = async (contactId: string) => {
        try {
            await MyServerApi.unblock(myDeviceId!, contactId);
            setBlockedList(prev => prev.filter(id => id !== contactId));
        } catch (err) { console.error(err); }
    };

    const currentContact = recipientId ? contacts.find((c: Contact) => c.id === recipientId) || null : null;
    const currentAction = recipientId ? contactActions[recipientId] : null;

    const handleExportKeys = async (password: string) => {
        const storedDeviceId = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
        const storedPrivateKey = localStorage.getItem(STORAGE_KEYS.PRIVATE_KEY);
        const storedPublicKey = localStorage.getItem(STORAGE_KEYS.PUBLIC_KEY);
        
        if (!storedDeviceId || !storedPrivateKey || !storedPublicKey) {
            alert(t("keysNotFound") || "Keys not found for export.");
            return;
        }
        
        if (!password) {
            alert("Backup cancelled. Password is required.");
            return;
        }
        
        try {
            const backupData = {
                deviceId: storedDeviceId,
                privateKey: JSON.parse(storedPrivateKey),
                publicKey: JSON.parse(storedPublicKey)
            };
            
            const encryptedBackup = await encryptBackup(backupData, password);
            
            const blob = new Blob([JSON.stringify(encryptedBackup, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "invisible-keys-backup.json";
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Encryption failed", err);
            alert("Failed to encrypt backup.");
        }
    };

    const handleImportKeys = async (file: File, password: string) => {
        try {
            const text = await file.text();
            const encryptedData = JSON.parse(text);
            
            if (!encryptedData.ciphertext || !encryptedData.iv || !encryptedData.salt) {
                throw new Error("Invalid encrypted backup file format.");
            }
            
            if (!password) {
                alert("Import cancelled. Password is required.");
                return;
            }
            
            const decryptedData = await decryptBackup(encryptedData, password) as any;
            
            if (!decryptedData.deviceId || !decryptedData.privateKey || !decryptedData.publicKey) {
                throw new Error("Decrypted data is invalid or missing required keys.");
            }
            
            localStorage.setItem(STORAGE_KEYS.DEVICE_ID, decryptedData.deviceId);
            localStorage.setItem(STORAGE_KEYS.PRIVATE_KEY, JSON.stringify(decryptedData.privateKey));
            localStorage.setItem(STORAGE_KEYS.PUBLIC_KEY, JSON.stringify(decryptedData.publicKey));
            
            alert(t("keysImported") || "Keys imported successfully. Reloading...");
            window.location.reload();
        } catch (err: any) {
            console.error("Failed to import keys", err);
            alert((t("keysImportFailed") || "Failed to import keys: ") + err.message);
        }
    };

    return {
        theme,
        setTheme,
        t,
        toggleLanguage,
        language,
        
        myDeviceId,
        myNickname,
        myAvatar,
        recipientId,
        messages,
        contacts,
        isSettingsOpen,
        setIsSettingsOpen,
        contactInput,
        setContactInput,
        blockedList,
        isInitialized,
        
        isInputDisabled: !recipientId || isSendingText || isSendingFile,
        
        currentContact,
        currentAction,
        contactActions,
        
        startRegistration,
        sendTextMessage,
        sendFileMessage,
        handleTyping,
        addContact,
        deleteContact,
        handleSelectContact,
        updateNickname,
        updateAvatar,
        handleLogout,
        blockContact,
        unblockContact,
        handleExportKeys,
        handleImportKeys,
        downloadDecryptedFile,
        decryptFileData
    };
}
