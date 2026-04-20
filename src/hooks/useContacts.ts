import { useState, useEffect, useRef } from 'react';
import { type Contact } from '../components/contacts-sidebar';

const CONTACTS_STORAGE_KEY = "messenger_contacts";

export function useContacts() {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const contactsRef = useRef<Contact[]>([]);

    useEffect(() => {
        const stored = localStorage.getItem(CONTACTS_STORAGE_KEY);
        if (stored) {
            try { setContacts(JSON.parse(stored)); } catch (e) { console.error(e); }
        }
    }, []);

    useEffect(() => { 
        localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(contacts)); 
        contactsRef.current = contacts;
    }, [contacts]);

    return { contacts, setContacts, contactsRef };
}
