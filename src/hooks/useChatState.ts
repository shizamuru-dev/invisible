import { useState, useRef, useEffect } from 'react';
import { type Message } from '../components/chat-area';

export function useChatState() {
    const [recipientId, setRecipientId] = useState<string | null>(null);
    const [messagesMap, setMessagesMap] = useState<Record<string, Message[]>>({});
    const recipientIdRef = useRef(recipientId);

    useEffect(() => { 
        recipientIdRef.current = recipientId; 
    }, [recipientId]);

    const messages = recipientId ? (messagesMap[recipientId] || []) : [];

    return { 
        recipientId, setRecipientId, recipientIdRef,
        messagesMap, setMessagesMap, messages
    };
}
