import { useState } from 'react';
import { UserPlus, MessageSquare, Search } from 'lucide-react';
import { ContactsSidebar, type Contact } from './components/contacts-sidebar';
import { ChatArea } from './components/chat-area';
import { DeviceIdHeader } from './components/device-id-header';
import { MessageInput } from './components/message-input';
import { SettingsModal } from './components/SettingsModal';
import { ThemeProvider, useTheme } from 'next-themes';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { Auth } from './components/auth/Auth';
import './styles/globals.css';

import { useContacts } from './hooks/useContacts';
import { useChatState } from './hooks/useChatState';
import { useE2EEInit } from './hooks/useE2EEInit';
import { useChatWebSocket } from './hooks/useChatWebSocket';

// ---------- Компонент ----------
function AppContent({ initialToken, initialUsername }: { initialToken: string, initialUsername: string }) {
    const { theme, setTheme } = useTheme();
    const { t, toggleLanguage, language } = useLanguage();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const { token, myUsername, myNickname, setMyNickname } = useE2EEInit(initialToken, initialUsername);
    const { contacts, setContacts, contactsRef } = useContacts();
    const { recipientId, setRecipientId, setMessagesMap, messages } = useChatState();

    const { wsRef, sendTextMessage, sendFileMessage } = useChatWebSocket({
        token, myUsername, contactsRef, setContacts, setMessagesMap, recipientId, t
    });

    const getDecryptedFileData = async (fileUrl: string): Promise<ArrayBuffer> => {
        const res = await fetch(fileUrl);
        return res.arrayBuffer();
    };

    const downloadDecryptedFile = async (fileUrl: string, metadata: { name: string; type: string }) => {
        try {
            const decrypted = await getDecryptedFileData(fileUrl);
            const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
            if (isTauri) {
                const savePath = await save({ defaultPath: metadata.name || "download" });
                if (savePath) {
                    await writeFile(savePath, new Uint8Array(decrypted));
                }
            } else {
                const blob = new Blob([decrypted], { type: metadata.type || "application/octet-stream" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url; a.download = metadata.name || "download"; document.body.appendChild(a); a.click(); document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        } catch (e) {
            console.error("Failed to download decrypted file", e);
        }
    };

    const addContact = async (id: string) => {
        if (!id.trim() || id === myUsername) return;
        if (contacts.some(c => c.id === id)) { setRecipientId(id);  return; }
        
        const newContact: Contact = { id, name: id, avatar: '', lastMessage: '', timestamp: '', online: false };
        setContacts(prev => [...prev, newContact]); setRecipientId(id); 
        
        if (wsRef.current?.readyState === 1) {
            wsRef.current.send(JSON.stringify({ type: "WatchPresence", user_ids: [id] }));
        }
    };

    const deleteContact = (contactId: string) => {
        setContacts(prev => prev.filter(c => c.id !== contactId));
        if (recipientId === contactId) { setRecipientId(null);  }
    };
    const handleSelectContact = (contactId: string) => { setRecipientId(contactId);  };
    const updateNickname = async (newNickname: string) => {
        if (!myUsername || !newNickname.trim()) return;
        setMyNickname(newNickname.trim());
    };

    const currentContact = recipientId ? contacts.find(c => c.id === recipientId) || null : null;
    if (!myUsername) return <div className="flex items-center justify-center h-screen">{t("loading")}</div>;

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
                    <DeviceIdHeader username={myUsername} onOpenSettings={() => setIsSettingsOpen(true)} t={t} />
                    {!recipientId ? <div className="flex-1 flex items-center justify-center text-muted-foreground">{t("enterDeviceId")}</div> : <>
                        <ChatArea contact={currentContact} messages={messages} currentUserId={myUsername} onDecryptAndDownloadFile={(fileUrl, metadata) => downloadDecryptedFile(fileUrl, metadata)} onDecryptAndGetFileData={(fileUrl) => getDecryptedFileData(fileUrl)} t={t} />
                        <MessageInput onSendMessage={sendTextMessage} onSendFile={sendFileMessage} disabled={!recipientId} t={t} />
                    </>}
                </div>
            </div>
            <SettingsModal token={token || initialToken} isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} currentNickname={myNickname} onUpdateNickname={updateNickname} currentTheme={theme} onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')} onToggleLanguage={toggleLanguage} currentLanguage={language} t={t} />
        </>
    );
}

function App() {
    const [token, setToken] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);

    return (
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            <LanguageProvider>
                {!token || !username ? (
                    <Auth onLogin={(token, user) => {
                        setToken(token);
                        setUsername(user);
                    }} />
                ) : (
                    <AppContent initialToken={token} initialUsername={username} />
                )}
            </LanguageProvider>
        </ThemeProvider>
    );
}

export default App;
