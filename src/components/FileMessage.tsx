"use client";

import { useState, useEffect } from "react";
import { Download, File, Film, FileText, Music, Image as ImageIcon } from "lucide-react";

interface FileMessageProps {
    fileName: string;
    fileType: string;
    fileSize: number;
    fileUrl: string;
    onDecryptAndDownload: (fileUrl: string) => Promise<void>;
    onDecryptAndGetData: (fileUrl: string) => Promise<ArrayBuffer>;
    localPreviewUrl?: string; // новый проп
    t: (key: string) => string;
}

export function FileMessage({ fileName, fileType, fileSize, fileUrl, onDecryptAndDownload, onDecryptAndGetData, localPreviewUrl, t }: FileMessageProps) {
    const [downloading, setDownloading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isImage = fileType.startsWith("image/");

    // Если есть локальный URL (для отправителя), используем его
    useEffect(() => {
        if (localPreviewUrl) {
            setPreviewUrl(localPreviewUrl);
            return;
        }
        if (isImage && !previewUrl && !loadingPreview && !error) {
            setLoadingPreview(true);
            onDecryptAndGetData(fileUrl)
                .then((buffer) => {
                    const blob = new Blob([buffer], { type: fileType });
                    const url = URL.createObjectURL(blob);
                    setPreviewUrl(url);
                })
                .catch((err) => {
                    console.error("Preview decryption failed", err);
                    setError("Preview decryption failed");
                })
                .finally(() => setLoadingPreview(false));
        }
        return () => {
            if (previewUrl && previewUrl !== localPreviewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [isImage, fileUrl, fileType, onDecryptAndGetData, localPreviewUrl]);

    const getFileIcon = () => {
        const iconClass = "h-8 w-8 text-foreground";
        if (isImage) return <ImageIcon className={iconClass} />;
        if (fileType.startsWith("video/")) return <Film className={iconClass} />;
        if (fileType.startsWith("audio/")) return <Music className={iconClass} />;
        if (fileType.includes("pdf") || fileType.includes("document")) return <FileText className={iconClass} />;
        return <File className={iconClass} />;
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / 1048576).toFixed(1) + " MB";
    };

    const handleDownload = async () => {
        setDownloading(true);
        try {
            if (localPreviewUrl) {
                // Если есть локальный URL, скачиваем по нему через Tauri API если доступно
                const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
                if (isTauri) {
                    const { save } = await import('@tauri-apps/plugin-dialog');
                    const { writeFile } = await import('@tauri-apps/plugin-fs');
                    const savePath = await save({ defaultPath: fileName });
                    if (savePath) {
                        const res = await fetch(localPreviewUrl);
                        const buffer = await res.arrayBuffer();
                        await writeFile(savePath, new Uint8Array(buffer));
                    }
                } else {
                    // Fallback to web download
                    const a = document.createElement("a");
                    a.href = localPreviewUrl;
                    a.download = fileName;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                }
            } else {
                await onDecryptAndDownload(fileUrl);
            }
        } catch (err) {
            console.error("Download failed", err);
        } finally {
            setDownloading(false);
        }
    };

    if (isImage && previewUrl) {
        return (
            <div className="flex flex-col gap-2 max-w-sm">
                <img src={previewUrl} alt={fileName} className="rounded-lg max-w-full max-h-64 object-contain border border-border" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{fileName} ({formatFileSize(fileSize)})</span>
                    <button onClick={handleDownload} disabled={downloading} className="p-1 rounded-full hover:bg-muted">
                        <Download className="h-4 w-4" />
                    </button>
                </div>
            </div>
        );
    }

    if (isImage && loadingPreview) {
        return (
            <div className="flex items-center gap-3 p-2 bg-muted rounded-lg max-w-sm border border-border">
                <ImageIcon className="h-8 w-8 text-foreground animate-pulse" />
                <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Loading preview...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-3 p-2 bg-muted rounded-lg max-w-sm border border-border">
            {getFileIcon()}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{fileName}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(fileSize)}</p>
                {error && <p className="text-xs text-red-500">Preview unavailable</p>}
            </div>
            <button
                onClick={handleDownload}
                disabled={downloading}
                className="p-1 rounded-full hover:bg-background transition-colors text-foreground"
                title={t("download")}
            >
                <Download className="h-4 w-4" />
            </button>
        </div>
    );
}