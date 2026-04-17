"use client";

import { useRef, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Contact } from "./contacts-sidebar";
import { FileMessage } from "./FileMessage";

export interface Message {
    id: string;
    senderId: string;
    type: "text" | "file";
    content?: string;
    fileData?: {
        file_url: string;
        metadata: {
            name: string;
            type: string;
            size: number;
        };
    };
    localPreviewUrl?: string; // для отправителя
    time: string;
    date: string;
}

interface ChatAreaProps {
    contact: Contact | null;
    messages: Message[];
    currentUserId: string;
    onDecryptAndDownloadFile: (fileUrl: string) => Promise<void>;
    onDecryptAndGetFileData: (fileUrl: string) => Promise<ArrayBuffer>;
    t: (key: string) => string;
}

function groupMessagesByDate(messages: Message[]): { date: string; messages: Message[] }[] {
    const groups: { date: string; messages: Message[] }[] = [];
    for (const msg of messages) {
        const lastGroup = groups[groups.length - 1];
        if (lastGroup && lastGroup.date === msg.date) {
            lastGroup.messages.push(msg);
        } else {
            groups.push({ date: msg.date, messages: [msg] });
        }
    }
    return groups;
}

export function ChatArea({ contact, messages, currentUserId, onDecryptAndDownloadFile, onDecryptAndGetFileData, t }: ChatAreaProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    if (!contact) {
        return (
            <div className="flex flex-1 items-center justify-center bg-background">
                <div className="text-center">
                    <div className="mb-2 text-6xl opacity-20">💬</div>
                    <p className="text-muted-foreground">{t("selectChat")}</p>
                </div>
            </div>
        );
    }

    const grouped = groupMessagesByDate(messages);

    return (
        <div className="flex flex-1 flex-col bg-background min-h-0">
            <div className="flex items-center gap-3 border-b border-border px-6 py-4 flex-shrink-0">
                <Avatar className="h-10 w-10">
                    <AvatarImage src={contact.avatar} alt={contact.name} />
                    <AvatarFallback className="bg-muted text-muted-foreground">
                        {contact.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                </Avatar>
                <div>
                    <h3 className="font-semibold text-foreground">{contact.name}</h3>
                    <p className="text-sm text-muted-foreground">
                        {contact.online ? t("online") : t("offline")}
                    </p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 min-h-0">
                <div className="mx-auto max-w-3xl space-y-6">
                    {grouped.map((group, idx) => (
                        <div key={idx}>
                            <div className="flex justify-center my-4">
                                <div className="bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground">
                                    {group.date}
                                </div>
                            </div>
                            <div className="space-y-4">
                                {group.messages.map((message) => {
                                    const isCurrentUser = message.senderId === currentUserId;
                                    return (
                                        <div
                                            key={message.id}
                                            className={cn("flex", isCurrentUser ? "justify-end" : "justify-start")}
                                        >
                                            <div
                                                className={cn(
                                                    "max-w-[70%] rounded-2xl px-4 py-2.5",
                                                    isCurrentUser
                                                        ? "bg-primary text-primary-foreground"
                                                        : "bg-muted text-foreground"
                                                )}
                                            >
                                                {message.type === "text" ? (
                                                    <p className="text-sm leading-relaxed">{message.content}</p>
                                                ) : (
                                                    <FileMessage
                                                     fileName={message.fileData!.metadata.name}
                                                     fileType={message.fileData!.metadata.type}
                                                     fileSize={message.fileData!.metadata.size}
                                                     fileUrl={message.fileData!.file_url}
                                                     onDecryptAndDownload={(fileUrl) => onDecryptAndDownloadFile(fileUrl)}
                                                     onDecryptAndGetData={onDecryptAndGetFileData}
                                                     localPreviewUrl={message.localPreviewUrl}
                                                     t={t}
                                                    />
                                                )}
                                                <p
                                                    className={cn(
                                                        "mt-1 text-xs",
                                                        isCurrentUser ? "text-primary-foreground/70" : "text-muted-foreground"
                                                    )}
                                                >
                                                    {message.time}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
            </div>
        </div>
    );
}