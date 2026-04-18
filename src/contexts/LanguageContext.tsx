"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Language = "ru" | "en";

interface Translations {
    [key: string]: {
        ru: string;
        en: string;
    };
}

const translations: Translations = {
    // Общие
    settings: { ru: "Настройки", en: "Settings" },
    nickname: { ru: "Никнейм", en: "Nickname" },
    save: { ru: "Сохранить", en: "Save" },
    theme: { ru: "Тема", en: "Theme" },
    darkMode: { ru: "Тёмная тема", en: "Dark mode" },
    lightMode: { ru: "Светлая тема", en: "Light mode" },
    language: { ru: "Язык", en: "Language" },
    copy: { ru: "Копировать", en: "Copy" },
    copied: { ru: "Скопировано", en: "Copied" },
    deviceId: { ru: "Имя пользователя", en: "Username" },
    username: { ru: "Имя пользователя", en: "Username" },
    online: { ru: "В сети", en: "Online" },
    offline: { ru: "Не в сети", en: "Offline" },
    selectChat: { ru: "Выберите чат для начала общения", en: "Select a conversation to start messaging" },
    enterDeviceId: { ru: "Введите имя пользователя в боковой панели", en: "Enter a Username in the sidebar" },
    enterDeviceIdPlaceholder: { ru: "Введите имя пользователя", en: "Enter Username" },
    add: { ru: "Добавить", en: "Add" },
    chats: { ru: "Чаты", en: "Chats" },
    typeMessage: { ru: "Напишите сообщение...", en: "Type a message..." },
    send: { ru: "Отправить", en: "Send" },
    deleteContact: { ru: "Удалить контакт", en: "Delete contact" },
    nicknamePlaceholder: { ru: "Ваш никнейм", en: "Your nickname" },
    updateNicknameSuccess: { ru: "Никнейм успешно обновлён", en: "Nickname updated successfully" },
    updateNicknameError: { ru: "Ошибка обновления ника", en: "Failed to update nickname" },
    sendFailed: { ru: "Ошибка отправки", en: "Send failed" },
    recipientNotFound: { ru: "Получатель не найден", en: "Recipient not found" },
    loading: { ru: "Загрузка...", en: "Loading..." },
    uploadingFile: { ru: "Отправка файла...", en: "Uploading file..." },
    file: { ru: "Файл", en: "File" },
    download: { ru: "Скачать", en: "Download" },
};

interface LanguageContextType {
    language: Language;
    t: (key: string) => string;
    toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLanguage] = useState<Language>(() => {
        const saved = localStorage.getItem("language");
        return saved === "en" ? "en" : "ru";
    });

    useEffect(() => {
        localStorage.setItem("language", language);
    }, [language]);

    const t = (key: string): string => {
        const entry = translations[key];
        if (!entry) return key;
        return entry[language];
    };

    const toggleLanguage = () => {
        setLanguage(prev => (prev === "ru" ? "en" : "ru"));
    };

    return (
        <LanguageContext.Provider value={{ language, t, toggleLanguage }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error("useLanguage must be used within a LanguageProvider");
    }
    return context;
}

