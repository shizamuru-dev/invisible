"use client";

import { memo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { X, Ban } from "lucide-react";

export interface Contact {
  id: string;
  name: string;
  avatar?: string;
  lastMessage: string;
  timestamp: string;
  unread?: number;
  online?: boolean;
}

interface ContactItemProps {
  contact: Contact;
  selectedContactId: string | null;
  action?: string;
  onSelectContact: (contactId: string) => void;
  onDeleteContact: (contactId: string) => void;
  onBlockContact: (contactId: string) => void;
  t: (key: string) => string;
}

const ContactItem = memo(({ contact, selectedContactId, action, onSelectContact, onDeleteContact, onBlockContact, t }: ContactItemProps) => {
  const getActionText = (action: string) => {
    switch (action) {
      case 'typing': return '✍️ Печатает...';
      case 'uploading': return '📎 Загружает файл...';
      case 'recording': return '🎙️ Записывает аудио...';
      default: return '';
    }
  };

  const actionText = action ? getActionText(action) : '';

  return (
    <div className="group relative">
      <button
        onClick={() => onSelectContact(contact.id)}
        className={cn(
          "flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-sidebar-accent",
          selectedContactId === contact.id && "bg-sidebar-accent"
        )}
      >
        <div className="relative">
          <Avatar className="h-12 w-12">
            <AvatarImage src={contact.avatar} alt={contact.name} />
            <AvatarFallback className="bg-muted text-muted-foreground">
              {contact.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {contact.online && (
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-sidebar bg-green-500" />
          )}
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sidebar-foreground">{contact.name}</span>
            <span className="text-xs text-muted-foreground">{contact.timestamp}</span>
          </div>
          <p className="truncate text-sm text-muted-foreground">{contact.lastMessage}</p>
          {actionText && (
            <p className="text-xs text-blue-500 italic animate-pulse">{actionText}</p>
          )}
        </div>
        {contact.unread && contact.unread > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
            {contact.unread}
          </span>
        )}
      </button>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onBlockContact(contact.id); }}
          className="p-1 rounded-full hover:bg-sidebar-accent"
          aria-label={t("block")}
          title={t("block")}
        >
          <Ban className="h-4 w-4 text-red-500" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDeleteContact(contact.id); }}
          className="p-1 rounded-full hover:bg-sidebar-accent"
          aria-label={t("deleteContact")}
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
});
ContactItem.displayName = "ContactItem";

interface ContactsSidebarProps {
  contacts: Contact[];
  selectedContactId: string | null;
  onSelectContact: (contactId: string) => void;
  onDeleteContact: (contactId: string) => void;
  onBlockContact: (contactId: string) => void;
  contactActions?: Record<string, string>;
  t: (key: string) => string;
}

export function ContactsSidebar({
  contacts,
  selectedContactId,
  onSelectContact,
  onDeleteContact,
  onBlockContact,
  contactActions = {},
  t,
}: ContactsSidebarProps) {
  return (
    <div className="flex h-full flex-col border-r border-border bg-sidebar">
      <div className="border-b border-border p-4">
        <h2 className="text-lg font-semibold text-sidebar-foreground">{t("chats")}</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {contacts.map((contact) => (
          <ContactItem
            key={contact.id}
            contact={contact}
            selectedContactId={selectedContactId}
            action={contactActions[contact.id]}
            onSelectContact={onSelectContact}
            onDeleteContact={onDeleteContact}
            onBlockContact={onBlockContact}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}