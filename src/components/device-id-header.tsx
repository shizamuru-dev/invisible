import { useState, useEffect } from "react";
import { Copy, Check, Settings } from "lucide-react";

export function DeviceIdHeader({ deviceId, nickname, avatar, onOpenSettings, t }) {
    const [copied, setCopied] = useState(false);
    const [localAvatar, setLocalAvatar] = useState(avatar);

    useEffect(() => {
        const handleStorage = () => setLocalAvatar(localStorage.getItem('avatar'));
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(deviceId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                    {localAvatar ? <img src={localAvatar} className="w-full h-full object-cover" /> : <span className="text-sm font-medium">{nickname.charAt(0).toUpperCase()}</span>}
                </div>
                <div><div className="font-medium text-sm">{nickname}</div><div className="text-xs text-muted-foreground font-mono">{deviceId}</div></div>
            </div>
            <div className="flex gap-2">
                <button onClick={handleCopy} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">{copied ? <><Check className="h-4 w-4 text-green-500" /> {t("copied")}</> : <><Copy className="h-4 w-4" /> {t("copy")}</>}</button>
                <button onClick={onOpenSettings} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><Settings className="h-4 w-4" /> {t("settings")}</button>
            </div>
        </header>
    );
}