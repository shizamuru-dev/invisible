import { useEffect, useRef } from 'react';
import { WS_URL, ApiClient } from '../lib/apiClient';
import { E2EE } from '../lib/e2ee';
import { type Message } from '../components/chat-area';
import { type Contact } from '../components/contacts-sidebar';

export function useChatWebSocket({
    token, myUsername,
    contactsRef, setContacts,
    setMessagesMap, recipientId, t
}: {
    token: string | null;
    myUsername: string | null;
    contactsRef: React.MutableRefObject<Contact[]>;
    setContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
    setMessagesMap: React.Dispatch<React.SetStateAction<Record<string, Message[]>>>;
    recipientId: string | null;
    t: (key: string) => string;
}) {
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        if (!token || !myUsername) return;
        let isMounted = true;
        const ws = new WebSocket(`${WS_URL}?token=${token}`);
        ws.onopen = () => {
            if (!isMounted) {
                ws.close();
                return;
            }
            console.log("WebSocket connected");
            const currentContacts = contactsRef.current;
            if (currentContacts.length > 0) {
                ws.send(JSON.stringify({ type: "WatchPresence", user_ids: currentContacts.map(c => c.id) }));
            }
        };
        
        ws.onmessage = async (event) => {
            if (!isMounted) return;
            const data = JSON.parse(event.data);
            const now = new Date();
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateStr = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

            if (data.type === "Text" || data.type === "Encrypted" || data.type === "File") {
                const targetChatId = data.from === myUsername ? data.to : data.from;
                
                if (targetChatId && targetChatId !== myUsername && !contactsRef.current.some(c => c.id === targetChatId)) {
                    if (ws.readyState === 1) {
                        ws.send(JSON.stringify({ type: "WatchPresence", user_ids: [targetChatId] }));
                    }
                }

                if (data.type === "Text" || data.type === "Encrypted") {
                    try {
                        let plaintext = "";
                        if (data.type === "Text") {
                            plaintext = data.content;
                        } else if (data.type === "Encrypted") {
                            let decrypted = null;
                            for (const ct of data.ciphertexts) {
                                try {
                                    const ctMsg = JSON.parse(atob(ct.ciphertext));
                                    const senderAddr = `${data.from}.${ct.device_id || 1}`; 
                                    plaintext = await E2EE.decryptMessage(senderAddr, ctMsg);
                                    decrypted = true;
                                    break;
                                } catch (e) {
                                }
                            }
                            if (!decrypted) {
                                plaintext = "[Encrypted message - Decryption Failed]";
                            }
                        }
                        
                        const msgId = data.id || crypto.randomUUID();
                        const newMsg: Message = { id: msgId, senderId: data.from || 'unknown', type: "text", content: plaintext, time: timeStr, date: dateStr };
                        setMessagesMap(prev => {
                            const existing = prev[targetChatId] || [];
                            if (existing.some(m => m.id === msgId)) return prev;
                            return { ...prev, [targetChatId]: [...existing, newMsg] };
                        });
                        
                        setContacts(prev => {
                            if (!prev.some(c => c.id === targetChatId)) {
                                return [...prev, { id: targetChatId, name: targetChatId, avatar: '', lastMessage: plaintext, timestamp: timeStr, online: true }];
                            }
                            return prev.map(c => c.id === targetChatId ? { ...c, lastMessage: plaintext, timestamp: timeStr } : c);
                        });
                    } catch (e) {
                        console.error("Failed to parse/decrypt incoming message", e);
                    }
                } else if (data.type === "File") {
                    const msgId = data.id || crypto.randomUUID();
                    const newMsg: Message = { id: msgId, senderId: data.from || 'unknown', type: "file", fileData: { file_url: data.file_url, metadata: { name: data.file_name, type: data.mime_type, size: data.file_size || 0 } }, time: timeStr, date: dateStr };
                    setMessagesMap(prev => {
                        const existing = prev[targetChatId] || [];
                        if (existing.some(m => m.id === msgId)) return prev;
                        return { ...prev, [targetChatId]: [...existing, newMsg] };
                    });
                    setContacts(prev => {
                        if (!prev.some(c => c.id === targetChatId)) {
                            return [...prev, { id: targetChatId, name: targetChatId, avatar: '', lastMessage: `[File] ${data.file_name}`, timestamp: timeStr, online: true }];
                        }
                        return prev.map(c => c.id === targetChatId ? { ...c, lastMessage: `[File] ${data.file_name}`, timestamp: timeStr } : c);
                    });
                }
            } else if (data.type === "PresenceUpdate") {
                setContacts(prev => prev.map(c => c.id === data.user_id ? { ...c, online: data.is_online } : c));
            }
        };

        wsRef.current = ws;
        return () => {
            isMounted = false;
            if (ws.readyState === 1 || ws.readyState === 0) {
                ws.close();
            }
        };
    }, [token, myUsername]); // Removed t to avoid unnecessary re-renders

    const sendTextMessage = async (text: string) => {
        if (!recipientId || !text.trim() || !wsRef.current || !token) return;
        
        try {
            const msgId = crypto.randomUUID();
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
                            signal_type: 3,
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
            const newMsg: Message = { id: msgId, senderId: myUsername!, type: "text", content: text, time: timeStr, date: dateStr };
            setMessagesMap(prev => ({ ...prev, [recipientId]: [...(prev[recipientId] || []), newMsg] }));
            setContacts(prev => prev.map(c => c.id === recipientId ? { ...c, lastMessage: text, timestamp: timeStr } : c));
        } catch (err) { console.error(err); alert(t("sendFailed")); }
    };

    const sendFileMessage = async (file: File) => {
        if (!recipientId || !wsRef.current || !token) return;
        try {
            const presignData = await ApiClient.presignFile(token, file.name, file.type);
            if (!presignData || !presignData.upload_url) throw new Error("Failed to get presign URL");
            
            const res = await fetch(presignData.upload_url, {
                method: "PUT",
                headers: { "Content-Type": file.type },
                body: file
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error("Upload failed: " + text);
            }

            const msgId = crypto.randomUUID();
            const payload = {
                type: "File",
                to: recipientId,
                id: msgId,
                file_name: file.name,
                mime_type: file.type,
                file_size: file.size,
                file_url: presignData.download_url
            };
            wsRef.current.send(JSON.stringify(payload));

            const localPreviewUrl = URL.createObjectURL(file);
            const now = new Date();
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateStr = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
            const newMsg: Message = { id: msgId, senderId: myUsername!, type: "file", fileData: { file_url: presignData.download_url, metadata: { name: file.name, type: file.type, size: file.size } }, localPreviewUrl, time: timeStr, date: dateStr };
            setMessagesMap(prev => ({ ...prev, [recipientId]: [...(prev[recipientId] || []), newMsg] }));
            setContacts(prev => prev.map(c => c.id === recipientId ? { ...c, lastMessage: `[File] ${file.name}`, timestamp: timeStr } : c));
        } catch (err) { console.error(err); alert(t("sendFailed")); }
    };

    return { wsRef, sendTextMessage, sendFileMessage };
}
