import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'ru' | 'en';

interface Translations {
    [key: string]: { ru: string; en: string };
}

const translations: Translations = {
 settings: { ru: "Настройки", en: "Settings" },
 nickname: { ru: "Никнейм", en: "Nickname" },
 save: { ru: "Сохранить", en: "Save" },
 theme: { ru: "Тема", en: "Theme" },
 lightMode: { ru: "Светлая", en: "Light" },
 darkMode: { ru: "Тёмная", en: "Dark" },
 language: { ru: "Язык", en: "Language" },
 copy: { ru: "Копировать", en: "Copy" },
 copied: { ru: "Скопировано", en: "Copied" },
 deviceId: { ru: "Device ID", en: "Device ID" },
 online: { ru: "В сети", en: "Online" },
 offline: { ru: "Не в сети", en: "Offline" },
 enterDeviceId: { ru: "Введите ID собеседника", en: "Enter recipient ID" },
 typeMessage: { ru: "Сообщение...", en: "Message..." },
 send: { ru: "Отправить", en: "Send" },
 add: { ru: "Добавить", en: "Add" },
 chats: { ru: "Чаты", en: "Chats" },
 file: { ru: "Файл", en: "File" },
 download: { ru: "Скачать", en: "Download" },
 uploadingFile: { ru: "Отправка файла...", en: "Uploading..." },
 loading: { ru: "Загрузка...", en: "Loading..." },
 logout: { ru: "Выйти", en: "Logout" },
 avatar: { ru: "Аватар", en: "Avatar" },
 uploadAvatar: { ru: "Загрузить", en: "Upload" },
 blockedUsers: { ru: "Заблокированные пользователи", en: "Blocked users" },
 noBlockedUsers: { ru: "Нет заблокированных", en: "No blocked users" },
 unblock: { ru: "Разблокировать", en: "Unblock" },
 block: { ru: "Заблокировать", en: "Block" },
 welcomeSubtitle: { ru: "Ваш приватный мессенджер", en: "Your private messenger" },
 start: { ru: "Начать", en: "Start" },
 selectAuthMode: { ru: "Выберите способ входа", en: "Select login method" },
 myServer: { ru: "Cервер (Device ID)", en: "My server (Device ID)" },
 colleagueServer: { ru: "Сервер (логин/пароль)", en: "Colleague's server (login/password)" },
 switchMode: { ru: "Сменить способ подключения", en: "Switch connection method" },
 enterDeviceIdPlaceholder: { ru: "Введите ID устройства", en: "Enter device ID" },
 selectChat: { ru: "Выберите чат для начала общения", en: "Select a conversation to start messaging" },
 deleteContact: { ru: "Удалить контакт", en: "Delete contact" },
 microphoneError: { ru: "Не удалось получить доступ к микрофону", en: "Could not access microphone" },
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