import { useState, useEffect, useRef } from "react";
import { Download, File, Film, FileText, Music, Image as ImageIcon, X, Play, Pause } from "lucide-react";

interface FileMessageProps {
    fileName: string;
    fileType: string;
    fileSize: number;
    encryptedData: any;
    onDecryptAndDownload: (encryptedData: any, metadata: any) => Promise<void>;  // теперь 2 аргумента
    onDecryptAndGetData: (encryptedData: any) => Promise<ArrayBuffer>;
    localPreviewUrl?: string | null;
    metadata?: any;
}

export function FileMessage({
    fileName,
    fileType,
    fileSize,
    encryptedData,
    onDecryptAndDownload,
    onDecryptAndGetData,
    localPreviewUrl,
    metadata,
}: FileMessageProps) {
    const [downloading, setDownloading] = useState(false);
    const previewUrl = localPreviewUrl || null;  // убрали setPreviewUrl
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isZoomed, setIsZoomed] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number | null>(null);
    const phaseRef = useRef<number>(0);

    const isImage = fileType.startsWith("image/");
    const isAudio = fileType.startsWith("audio/") || fileName.endsWith(".webm");

    useEffect(() => {
        if (isAudio && !audioUrl && !loadingPreview && !error && !localPreviewUrl) {
            setLoadingPreview(true);
            if (metadata?.unencrypted) {
                const ciphertext = encryptedData.ciphertext;
                if (ciphertext && Array.isArray(ciphertext) && ciphertext.length > 0) {
                    const buffer = new Uint8Array(ciphertext).buffer;
                    const blob = new Blob([buffer], { type: fileType });
                    const url = URL.createObjectURL(blob);
                    setAudioUrl(url);
                } else {
                    setError("Invalid audio data");
                }
                setLoadingPreview(false);
            } else {
                onDecryptAndGetData(encryptedData)
                    .then((buffer: ArrayBuffer) => {
                        if (buffer.byteLength === 0) throw new Error("Empty buffer");
                        const blob = new Blob([buffer], { type: fileType });
                        const url = URL.createObjectURL(blob);
                        setAudioUrl(url);
                    })
                    .catch((err) => {
                        console.error("Decryption failed", err);
                        setError("Audio decryption failed");
                    })
                    .finally(() => setLoadingPreview(false));
            }
        }
        return () => {
            if (audioUrl) URL.revokeObjectURL(audioUrl);
        };
    }, [isAudio, encryptedData, onDecryptAndGetData, localPreviewUrl, metadata]);

    useEffect(() => {
        if (!audioUrl) return;
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.onended = () => {
            setIsPlaying(false);
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
        audio.onerror = (e) => {
            console.error("Audio element error", e);
            setError("Audio playback error");
        };
        return () => {
            audio.pause();
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [audioUrl]);

    const drawWave = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);
        const bars = 30;
        const step = width / bars;
        if (!isPlaying) {
            for (let i = 0; i < bars; i++) {
                const x = i * step;
                const t = (i / bars) * Math.PI * 2;
                const h = 8 + Math.sin(t) * 4;
                ctx.fillStyle = "#888";
                ctx.fillRect(x, (height - h) / 2, step - 2, h);
            }
            return;
        }
        const animate = () => {
            if (!isPlaying) return;
            ctx.clearRect(0, 0, width, height);
            phaseRef.current += 0.05;
            for (let i = 0; i < bars; i++) {
                const x = i * step;
                const t = (i / bars) * Math.PI * 2 + phaseRef.current;
                const h = 10 + Math.sin(t) * 8;
                ctx.fillStyle = "#007aff";
                ctx.fillRect(x, (height - h) / 2, step - 2, h);
            }
            animationRef.current = requestAnimationFrame(animate);
        };
        animate();
    };

    useEffect(() => {
        if (canvasRef.current) drawWave();
    }, [isPlaying, audioUrl]);

    const handlePlayPause = async () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        } else {
            try {
                await audioRef.current.play();
                setIsPlaying(true);
            } catch (e) {
                console.error("Play error:", e);
                setError("Cannot play audio");
            }
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / 1048576).toFixed(1) + " MB";
    };

    const handleDownload = async () => {
        setDownloading(true);
        try {
            if (localPreviewUrl) {
                const a = document.createElement("a");
                a.href = localPreviewUrl;
                a.download = fileName;
                a.click();
            } else {
                await onDecryptAndDownload(encryptedData, metadata);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setDownloading(false);
        }
    };

    const getFileIcon = () => {
        const iconClass = "h-8 w-8 text-foreground";
        if (isImage) return <ImageIcon className={iconClass} />;
        if (fileType.startsWith("video/")) return <Film className={iconClass} />;
        if (isAudio) return <Music className={iconClass} />;
        if (fileType.includes("pdf") || fileType.includes("document")) return <FileText className={iconClass} />;
        return <File className={iconClass} />;
    };

    if (isImage && previewUrl) {
        return (
            <>
                <div className="flex flex-col gap-2 max-w-sm">
                    <img
                        src={previewUrl}
                        alt={fileName}
                        className="rounded-lg max-w-full max-h-64 object-contain border border-border cursor-pointer hover:opacity-90"
                        onClick={() => setIsZoomed(true)}
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{fileName} ({formatSize(fileSize)})</span>
                        <button onClick={handleDownload} disabled={downloading} className="p-1 rounded-full hover:bg-muted">
                            <Download className="h-4 w-4" />
                        </button>
                    </div>
                </div>
                {isZoomed && (
                    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setIsZoomed(false)}>
                        <button className="absolute top-4 right-4 text-white p-2 rounded-full bg-black/50 hover:bg-black/70">
                            <X className="h-6 w-6" />
                        </button>
                        <img src={previewUrl} alt={fileName} className="max-w-[90vw] max-h-[90vh] object-contain" />
                    </div>
                )}
            </>
        );
    }

    if (isAudio && audioUrl) {
        return (
            <div className="flex items-center gap-3 p-2 bg-card rounded-lg max-w-sm border border-border shadow-sm">
                <button
                    onClick={handlePlayPause}
                    className="p-1 rounded-full hover:bg-accent transition-colors"
                >
                    {isPlaying ? <Pause className="h-5 w-5 text-foreground" /> : <Play className="h-5 w-5 text-foreground" />}
                </button>
                <canvas ref={canvasRef} width={120} height={30} className="flex-1" style={{ width: "120px", height: "30px" }} />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{fileName}</p>
                    <p className="text-xs text-muted-foreground">{formatSize(fileSize)}</p>
                </div>
                <button onClick={handleDownload} disabled={downloading} className="p-1 rounded-full hover:bg-accent transition-colors">
                    <Download className="h-4 w-4 text-foreground" />
                </button>
            </div>
        );
    }

    if ((isImage && loadingPreview) || (isAudio && loadingPreview)) {
        return (
            <div className="flex items-center gap-3 p-2 bg-muted rounded-lg max-w-sm border border-border">
                <div className="animate-pulse">Загрузка...</div>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-3 p-2 bg-card rounded-lg max-w-sm border border-border shadow-sm">
            {getFileIcon()}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{fileName}</p>
                <p className="text-xs text-muted-foreground">{formatSize(fileSize)}</p>
                {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
            <button onClick={handleDownload} disabled={downloading} className="p-1 rounded-full hover:bg-accent transition-colors">
                <Download className="h-4 w-4 text-foreground" />
            </button>
        </div>
    );
}