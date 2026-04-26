import { useState, useRef, useCallback } from "react";
import { Send, Paperclip, Mic, Square } from "lucide-react";

interface MessageInputProps {
    onSendMessage: (content: string) => void;
    onSendFile: (file: File) => Promise<void>;
    onTyping?: (text: string) => void;
    disabled?: boolean;
    t: (key: string) => string;
}

export function MessageInput({ onSendMessage, onSendFile, onTyping, disabled, t }: MessageInputProps) {
    const [message, setMessage] = useState("");
    const [uploading, setUploading] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isSendingRef = useRef(false);
    const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastTypingSentRef = useRef<number>(0);

    const handleTyping = useCallback((value: string) => {
        setMessage(value);
        if (!onTyping) return;

        const now = Date.now();
        if (now - lastTypingSentRef.current > 1000) {
            if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
            onTyping(value);
            lastTypingSentRef.current = now;
        } else {
            if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
            typingDebounceRef.current = setTimeout(() => {
                onTyping(value);
                lastTypingSentRef.current = Date.now();
            }, 1000 - (now - lastTypingSentRef.current));
        }

        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => {
            // Ничего не делаем, таймер только для сброса через 3 секунды на стороне получателя
        }, 3000);
    }, [onTyping]);

    const handleFile = useCallback(async (file: File) => {
        if (disabled || isSendingRef.current) return;
        isSendingRef.current = true;
        setUploading(true);
        try {
            await onSendFile(file);
        } catch (err) {
            console.error(err);
        } finally {
            setUploading(false);
            isSendingRef.current = false;
        }
    }, [disabled, onSendFile]);

    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        if (disabled) return;
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of items) {
            if (item.type.startsWith("image/")) {
                const file = item.getAsFile();
                if (file) {
                    e.preventDefault();
                    handleFile(file);
                    break;
                }
            }
        }
    }, [disabled, handleFile]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        if (disabled) return;
        e.preventDefault();
        setIsDragOver(true);
    }, [disabled]);
    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    }, []);
    const handleDrop = useCallback((e: React.DragEvent) => {
        if (disabled) return;
        e.preventDefault();
        setIsDragOver(false);
        const files = e.dataTransfer?.files;
        if (files && files.length) handleFile(files[0]);
    }, [disabled, handleFile]);

    const startRecording = useCallback(async () => {
        if (disabled || isRecording) return;
        if (onTyping) onTyping('recording');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            let mimeType = "";
            if (MediaRecorder.isTypeSupported("audio/webm")) mimeType = "audio/webm";
            else if (MediaRecorder.isTypeSupported("audio/mp4")) mimeType = "audio/mp4";
            else if (MediaRecorder.isTypeSupported("audio/wav")) mimeType = "audio/wav";
            const options = mimeType ? { mimeType } : undefined;
            const mediaRecorder = new MediaRecorder(stream, options);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || "audio/webm" });
                const file = new File([audioBlob], `voice_${Date.now()}.webm`, { type: audioBlob.type });
                handleFile(file);
                stream.getTracks().forEach(track => track.stop());
                if (timerRef.current) clearInterval(timerRef.current);
                setRecordingTime(0);
                setIsRecording(false);
            };

            mediaRecorder.start();
            setIsRecording(true);
            timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
        } catch (err) {
            console.error("Microphone access denied", err);
            alert(t("microphoneError") || "Не удалось получить доступ к микрофону");
        }
    }, [disabled, isRecording, onTyping, handleFile, t]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording) mediaRecorderRef.current.stop();
    }, [isRecording]);

    const handleSubmit = useCallback(() => {
        if (disabled) return;
        if (message.trim() && !uploading && !isRecording) {
            onSendMessage(message.trim());
            setMessage("");
        }
    }, [disabled, message, uploading, isRecording, onSendMessage]);

    return (
        <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-t border-border bg-card p-4 transition-colors ${isDragOver ? "bg-muted" : ""}`}
        >
            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="mx-auto flex max-w-3xl items-center gap-3">
                <input type="file" ref={fileInputRef} onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); if (fileInputRef.current) fileInputRef.current.value = ""; }} disabled={disabled || uploading || isRecording} className="hidden" id="file-input" />
                <label htmlFor="file-input" className={`cursor-pointer p-2 rounded-full hover:bg-muted transition-colors ${disabled || uploading || isRecording ? "opacity-50 cursor-not-allowed" : ""}`}>
                    <Paperclip className="h-5 w-5" />
                </label>

                {!isRecording ? (
                    <button type="button" onClick={startRecording} disabled={disabled || uploading} className={`p-2 rounded-full hover:bg-muted transition-colors ${disabled || uploading ? "opacity-50 cursor-not-allowed" : ""}`}>
                        <Mic className="h-5 w-5" />
                    </button>
                ) : (
                    <button type="button" onClick={stopRecording} className="p-2 rounded-full bg-red-500 text-white animate-pulse">
                        <Square className="h-5 w-5 fill-white" />
                    </button>
                )}

                <textarea
                    value={message}
                    onChange={(e) => handleTyping(e.target.value)}
                    onPaste={handlePaste}
                    placeholder={uploading ? t("uploadingFile") : isRecording ? `Запись... ${recordingTime}с` : t("typeMessage")}
                    disabled={disabled || uploading || isRecording}
                    rows={1}
                    className="flex-1 resize-none rounded-xl border border-input bg-input px-4 py-3 text-sm focus:outline-none focus:ring-2"
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                />
                <button type="submit" disabled={disabled || (!message.trim() && !uploading) || uploading || isRecording} className="h-11 w-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
                    <Send className="h-5 w-5" />
                </button>
            </form>
        </div>
    );
}