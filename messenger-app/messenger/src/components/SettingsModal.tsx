"use client";

import { useState, useEffect } from "react";
import { X, Sun, Moon, Languages } from "lucide-react";

interface SettingsModalProps {
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

export function SettingsModal({
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

    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
        } else {
            const timer = setTimeout(() => setShouldRender(false), 200);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!shouldRender) return null;

    const handleSaveNickname = () => {
        if (nickname.trim() && nickname !== currentNickname) {
            onUpdateNickname(nickname.trim());
        }
        onClose();
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
                </div>
            </div>
        </div>
    );
}