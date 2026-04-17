"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Send, Paperclip } from "lucide-react";

interface MessageInputProps {
    onSendMessage: (content: string) => void;
    onSendFile: (file: File) => Promise<void>;
    disabled?: boolean;
    t: (key: string) => string;
}

export function MessageInput({ onSendMessage, onSendFile, disabled, t }: MessageInputProps) {
    const [message, setMessage] = useState("");
    const [uploading, setUploading] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (message.trim() && !disabled && !uploading) {
            onSendMessage(message.trim());
            setMessage("");
        }
    };

    const handleFile = async (file: File) => {
        setUploading(true);
        try {
            await onSendFile(file);
        } catch (err) {
            console.error("File send failed", err);
        } finally {
            setUploading(false);
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
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
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            handleFile(files[0]);
        }
    };

    return (
        <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-t border-border bg-card p-4 transition-colors ${isDragOver ? "bg-muted" : ""}`}
        >
            <form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl items-center gap-3">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => {
                        if (e.target.files?.[0]) handleFile(e.target.files[0]);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    disabled={disabled || uploading}
                    className="hidden"
                    id="file-input"
                    accept="image/*,video/*,application/pdf,.doc,.docx,.txt"
                />
                <label
                    htmlFor="file-input"
                    className={`cursor-pointer p-2 rounded-full hover:bg-muted transition-colors ${
                        disabled || uploading ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                >
                    <Paperclip className="h-5 w-5" />
                </label>
                <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onPaste={handlePaste}
                    placeholder={uploading ? t("uploadingFile") : t("typeMessage")}
                    disabled={disabled || uploading}
                    rows={1}
                    className="flex-1 resize-none rounded-xl border border-input bg-input px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ minHeight: "44px", maxHeight: "120px" }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit(e);
                        }
                    }}
                />
                <Button
                    type="submit"
                    size="icon"
                    disabled={(!message.trim() && !uploading) || disabled || uploading}
                    className="h-11 w-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                >
                    <Send className="h-5 w-5" />
                    <span className="sr-only">{t("send")}</span>
                </Button>
            </form>
        </div>
    );
}