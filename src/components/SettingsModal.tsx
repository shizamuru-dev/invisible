import { useState, useEffect } from "react";
import { X, Sun, Moon, Languages, LogOut, Upload, UserX, UserCheck, RefreshCw } from "lucide-react";
import { MyServerApi as ApiClient } from "../lib/apiClient";

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentNickname: string;
    onUpdateNickname: (newNickname: string) => void;
    currentTheme?: string;
    onToggleTheme: () => void;
    onToggleLanguage: () => void;
    currentLanguage: string;
    onLogout: () => void;
    avatar: string | null;
    onAvatarChange: (avatar: string) => void;
    blockedList: string[];
    onUnblock: (userId: string) => Promise<void>;
    onSwitchMode: () => void; // новый проп
    t: (key: string) => string;
    compressImage: (file: File) => Promise<string>;
}

export function SettingsModal({
    isOpen,
    onClose,
    currentNickname,
    onUpdateNickname,
    currentTheme,
    onToggleTheme,
    onToggleLanguage,
    currentLanguage,
    onLogout,
    avatar,
    onAvatarChange,
    blockedList,
    onUnblock,
    onSwitchMode,
    t,
    compressImage,
}: SettingsModalProps) {
    const [nickname, setNickname] = useState(currentNickname);
    const [shouldRender, setShouldRender] = useState(false);
    const [localAvatar, setLocalAvatar] = useState(avatar);
    const [blockedDetails, setBlockedDetails] = useState<{ id: string; name: string }[]>([]);

    useEffect(() => {
        if (isOpen) setShouldRender(true);
        else {
            const timer = setTimeout(() => setShouldRender(false), 200);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    useEffect(() => {
        const fetchBlockedDetails = async () => {
            const details = await Promise.all(
                blockedList.map(async (id) => {
                    try {
                        const { nickname } = await ApiClient.getNickname(id);
                        return { id, name: nickname };
                    } catch {
                        return { id, name: `User ${id.slice(-4)}` };
                    }
                })
            );
            setBlockedDetails(details);
        };
        if (blockedList.length) fetchBlockedDetails();
        else setBlockedDetails([]);
    }, [blockedList]);

    if (!shouldRender) return null;

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            if (file.size > 2 * 1024 * 1024) {
                alert("File too large, max 2MB");
                return;
            }
            try {
                const compressed = await compressImage(file);
                setLocalAvatar(compressed);
                onAvatarChange(compressed);
            } catch (err) {
                console.error(err);
                alert("Failed to compress image");
            }
        }
    };

    const handleSaveNickname = () => {
        if (nickname.trim() && nickname !== currentNickname) onUpdateNickname(nickname.trim());
        onClose();
    };

    const handleUnblock = async (userId: string) => {
        await onUnblock(userId);
        setBlockedDetails(prev => prev.filter(b => b.id !== userId));
    };

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-200 ${isOpen ? "bg-black/50" : "bg-black/0"}`} onClick={onClose}>
            <div className={`bg-background rounded-lg shadow-lg w-full max-w-md p-6 transform transition-all duration-200 ${isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"}`} onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">{t("settings")}</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-muted"><X className="h-5 w-5" /></button>
                </div>
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium mb-2">{t("avatar")}</label>
                        <div className="flex items-center gap-4">
                            {localAvatar && <img src={localAvatar} alt="Avatar" className="w-16 h-16 rounded-full object-cover border" />}
                            <label className="cursor-pointer bg-primary text-primary-foreground px-3 py-2 rounded-md text-sm hover:bg-primary/90">
                                <Upload className="inline w-4 h-4 mr-1" /> {t("uploadAvatar")}
                                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} className="hidden" />
                            </label>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">{t("nickname")}</label>
                        <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} className="w-full px-3 py-2 border rounded-md bg-background" />
                        <button onClick={handleSaveNickname} className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">{t("save")}</button>
                    </div>
                    <div className="border-t pt-4">
                        <label className="block text-sm font-medium mb-2">{t("theme")}</label>
                        <button onClick={onToggleTheme} className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-muted">
                            {currentTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                            {currentTheme === 'dark' ? t("lightMode") : t("darkMode")}
                        </button>
                    </div>
                    <div className="border-t pt-4">
                        <label className="block text-sm font-medium mb-2">{t("language")}</label>
                        <button onClick={onToggleLanguage} className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-muted">
                            <Languages className="h-4 w-4" /> {currentLanguage === 'ru' ? 'English' : 'Русский'}
                        </button>
                    </div>
                    <div className="border-t pt-4">
                        <div className="flex items-center gap-2 mb-2">
                            <UserX className="h-5 w-5 text-red-500" />
                            <label className="text-sm font-medium">{t("blockedUsers")}</label>
                        </div>
                        {blockedDetails.length === 0 ? (
                            <p className="text-sm text-muted-foreground">{t("noBlockedUsers")}</p>
                        ) : (
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                {blockedDetails.map(user => (
                                    <div key={user.id} className="flex items-center justify-between p-2 border rounded-md">
                                        <span className="text-sm">{user.name}</span>
                                        <button onClick={() => handleUnblock(user.id)} className="flex items-center gap-1 text-sm text-green-600 hover:text-green-800">
                                            <UserCheck className="h-4 w-4" /> {t("unblock")}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="border-t pt-4">
                        <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors">
                            <LogOut className="h-4 w-4" /> {t("logout")}
                        </button>
                        <button onClick={onSwitchMode} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors mt-2">
                            <RefreshCw className="h-4 w-4" /> {t("switchMode")}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}