"use client";

import { useState, useEffect } from "react";
import { X, Sun, Moon, Languages, MonitorSmartphone } from "lucide-react";
import { ApiClient } from "../lib/apiClient";

interface SettingsModalProps {
    token: string;
    isOpen: boolean;
    onClose: () => void;
    currentNickname: string;
    onUpdateNickname: (newNickname: string) => void;
    currentTheme?: string;
    onToggleTheme: () => void;
    onToggleLanguage: () => void;
    currentLanguage: string;
    t: (key: string) => string;
}

interface Session {
    id: string;
    device: string;
    lastActive: string;
    isCurrent: boolean;
}

export function SettingsModal({
    token,
    isOpen,
    onClose,
    currentNickname,
    onUpdateNickname,
    currentTheme,
    onToggleTheme,
    onToggleLanguage,
    currentLanguage,
    t,
}: SettingsModalProps) {
    const [nickname, setNickname] = useState(currentNickname);
    const [shouldRender, setShouldRender] = useState(false);
    const [sessions, setSessions] = useState<Session[]>([]);

    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            
            let currentSessionId = "";
            try {
                if (token) {
                    const payload = JSON.parse(atob(token.split('.')[1]));
                    currentSessionId = payload.session_id;
                }
            } catch (e) {
                console.error("Failed to parse token", e);
            }

            if (token) {
                ApiClient.getDevices(token)
                    .then((data: any[]) => {
                        setSessions(data.map(d => {
                            const deviceStr = [d.device_name, d.device_model, d.platform]
                                .filter(Boolean).join(' - ');
                            return {
                                id: d.device_id,
                                device: deviceStr || 'Unknown Device',
                                lastActive: new Date(d.created_at).toLocaleString(),
                                isCurrent: d.device_id === currentSessionId
                            };
                        }));
                    })
                    .catch(console.error);
            }
        } else {
            const timer = setTimeout(() => setShouldRender(false), 200);
            return () => clearTimeout(timer);
        }
    }, [isOpen, token]);

    if (!shouldRender) return null;

    const handleSaveNickname = () => {
        if (nickname.trim() && nickname !== currentNickname) {
            onUpdateNickname(nickname.trim());
        }
        onClose();
    };

    const handleTerminate = async (id: string) => {
        try {
            await ApiClient.deleteDevice(token, id);
            setSessions(prev => prev.filter(s => s.id !== id));
        } catch (error) {
            console.error("Failed to terminate session", error);
        }
    };

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-200 ${
                isOpen ? "bg-black/50" : "bg-black/0"
            }`}
            onClick={onClose}
        >
            <div
                className={`bg-background rounded-lg shadow-lg w-full max-w-md p-6 transform transition-all duration-200 ${
                    isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"
                }`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">{t("settings")}</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-muted">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium mb-1">{t("nickname")}</label>
                        <input
                            type="text"
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            className="w-full px-3 py-2 border rounded-md"
                            placeholder={t("nicknamePlaceholder")}
                        />
                        <button
                            onClick={handleSaveNickname}
                            className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                        >
                            {t("save")}
                        </button>
                    </div>
                    <div className="border-t pt-4">
                        <label className="block text-sm font-medium mb-2">{t("theme")}</label>
                        <button
                            onClick={onToggleTheme}
                            className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-muted"
                        >
                            {currentTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                            {currentTheme === 'dark' ? t("lightMode") : t("darkMode")}
                        </button>
                    </div>
                    <div className="border-t pt-4">
                        <label className="block text-sm font-medium mb-2">{t("language")}</label>
                        <button
                            onClick={onToggleLanguage}
                            className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-muted"
                        >
                            <Languages className="h-4 w-4" />
                            {currentLanguage === 'ru' ? 'English' : 'Русский'}
                        </button>
                    </div>
                    <div className="border-t pt-4">
                        <label className="block text-sm font-medium mb-2">{t("sessionManagement")}</label>
                        <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                            {sessions.map(session => (
                                <div key={session.id} className="flex items-center justify-between p-2 border rounded-md text-sm bg-muted/50">
                                    <div className="flex items-center gap-2">
                                        <MonitorSmartphone className="w-4 h-4 text-muted-foreground" />
                                        <div className="flex flex-col">
                                            <span className="font-medium">{session.device} {session.isCurrent && <span className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded ml-1">{t("currentSession")}</span>}</span>
                                            <span className="text-xs text-muted-foreground">{session.lastActive}</span>
                                        </div>
                                    </div>
                                    {!session.isCurrent && (
                                        <button 
                                            onClick={() => handleTerminate(session.id)}
                                            className="text-red-500 hover:bg-red-500/10 px-2 py-1 rounded text-xs transition-colors"
                                        >
                                            {t("terminateSession")}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}