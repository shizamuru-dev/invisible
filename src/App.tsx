import { useState, useEffect } from 'react';
import { ContactsSidebar } from './components/contacts-sidebar';
import { ChatArea } from './components/chat-area';
import { DeviceIdHeader } from './components/device-id-header';
import { MessageInput } from './components/message-input';
import { SettingsModal } from './components/SettingsModal';
import { ThemeProvider } from 'next-themes';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { useMyServerChat } from './hooks/useMyServerChat';
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
    const chat = useMyServerChat(onSwitchMode);

    if (!chat.isInitialized && !chat.myDeviceId) {
        return <WelcomeScreen onStart={chat.startRegistration} />;
    }

    return (
        <>
            <div className="flex h-screen">
                <div className="w-80 border-r border-border bg-background flex flex-col">
                    <div className="p-4 border-b">
                        <h2 className="font-semibold mb-2">{chat.t("chats")}</h2>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={chat.contactInput}
                                onChange={(e) => chat.setContactInput(e.target.value)}
                                placeholder={chat.t("enterDeviceIdPlaceholder")}
                                className="flex-1 px-2 py-1 border rounded text-sm"
                                onKeyPress={(e) => { if (e.key === 'Enter') chat.addContact(chat.contactInput); }}
                            />
                            <button onClick={() => chat.addContact(chat.contactInput)} className="px-2 py-1 bg-blue-500 text-white rounded text-sm">
                                {chat.t("add")}
                            </button>
                        </div>
                    </div>
                    <ContactsSidebar
                        contacts={chat.contacts}
                        selectedContactId={chat.recipientId}
                        onSelectContact={chat.handleSelectContact}
                        onDeleteContact={chat.deleteContact}
                        onBlockContact={chat.blockContact}
                        t={chat.t}
                        contactActions={chat.contactActions}
                    />
                </div>
                <div className="flex-1 flex flex-col min-w-0">
                    <DeviceIdHeader deviceId={chat.myDeviceId!} nickname={chat.myNickname} avatar={chat.myAvatar} onOpenSettings={() => chat.setIsSettingsOpen(true)} t={chat.t} />
                    {!chat.recipientId ? <div className="flex-1 flex items-center justify-center text-muted-foreground">{chat.t("enterDeviceId")}</div> : <>
                        <ChatArea 
                            contact={chat.currentContact ? { ...chat.currentContact, action: chat.currentAction || undefined } : null} 
                            messages={chat.messages} 
                            currentUserId={chat.myDeviceId!} 
                            onDecryptAndDownloadFile={chat.downloadDecryptedFile} 
                            onDecryptAndGetFileData={chat.decryptFileData} 
                            t={chat.t} 
                        />
                        <MessageInput 
                            onSendMessage={chat.sendTextMessage} 
                            onSendFile={chat.sendFileMessage} 
                            onTyping={chat.handleTyping}
                            disabled={chat.isInputDisabled} 
                            t={chat.t} 
                        />
                    </>}
                </div>
            </div>
            <SettingsModal
                isOpen={chat.isSettingsOpen}
                onClose={() => chat.setIsSettingsOpen(false)}
                currentNickname={chat.myNickname}
                onUpdateNickname={chat.updateNickname}
                currentTheme={chat.theme}
                onToggleTheme={() => chat.setTheme(chat.theme === 'dark' ? 'light' : 'dark')}
                onToggleLanguage={chat.toggleLanguage}
                currentLanguage={chat.language}
                onLogout={chat.handleLogout}
                avatar={chat.myAvatar}
                onAvatarChange={chat.updateAvatar}
                blockedList={chat.blockedList}
                onUnblock={chat.unblockContact}
                onSwitchMode={onSwitchMode}
                onExportKeys={chat.handleExportKeys}
                onImportKeys={chat.handleImportKeys}
                t={chat.t}
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