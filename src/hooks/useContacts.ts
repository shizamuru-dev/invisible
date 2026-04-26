import { useState, useEffect, useRef } from 'react';
import { type Contact } from '../components/contacts-sidebar';
import { STORAGE_KEYS } from '../lib/constants';

export function useContacts() {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const contactsRef = useRef<Contact[]>([]);

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEYS.CONTACTS);
        if (stored) {
            try { setContacts(JSON.parse(stored)); } catch (e) { console.error(e); }
        }
    }, []);

    useEffect(() => { 
        const timeoutId = setTimeout(() => {
            localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(contacts)); 
            contactsRef.current = contacts;
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [contacts]);

    return { contacts, setContacts, contactsRef };
}
