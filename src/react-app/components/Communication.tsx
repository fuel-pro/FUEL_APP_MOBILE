import { useState, useEffect, useRef } from "react";
import {
  Users,
  Send,
  MessageSquare,
  Mail,
  Phone,
  Search,
  Plus,
  Edit,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  User,
  MessageCircleMore,
  Archive,
  Star,
  Download,
} from "lucide-react";
import { useFuel } from "@/react-app/context/FuelContext";
import { useAuth } from "@/react-app/context/AuthContext";
import { useStations } from "@/react-app/context/StationContext";
import cloudStorageService from "@/react-app/lib/cloud-storage-service";

interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string;
  company: string;
  tags: string[];
  balance: number;
  lastContact: string;
  notes: string;
  starred: boolean;
}

interface Message {
  id: string;
  contactId: string;
  type: "sms" | "email" | "call";
  content: string;
  subject?: string;
  status: "sent" | "delivered" | "failed" | "pending";
  timestamp: string;
  sentBy: string;
}

interface MessageTemplate {
  id: string;
  name: string;
  type: "sms" | "email";
  subject?: string;
  content: string;
  category: string;
}

/**
 * Normalize a contact from cloud/localStorage so it always has every field
 * the UI expects. Cloud data may be partial (from older app versions, API
 * imports, or cross-device sync where the record was created with a subset of
 * fields). Without this, rendering crashes with
 * "Cannot read properties of undefined (reading 'map')" etc.
 */
function normalizeContact(c: Partial<Contact> | null | undefined): Contact {
  const id =
    c?.id || `ct_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    name: c?.name ?? "",
    phone: c?.phone ?? "",
    email: c?.email ?? "",
    company: c?.company ?? "",
    tags: Array.isArray(c?.tags) ? c.tags : [],
    balance: typeof c?.balance === "number" ? c.balance : 0,
    lastContact: c?.lastContact ?? "",
    notes: c?.notes ?? "",
    starred: typeof c?.starred === "boolean" ? c.starred : false,
  };
}

function normalizeMessage(m: Partial<Message> | null | undefined): Message {
  const id =
    m?.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    contactId: m?.contactId ?? "",
    type: m?.type === "email" || m?.type === "call" ? m.type : "sms",
    content: m?.content ?? "",
    subject: m?.subject,
    status:
      m?.status === "sent" ||
      m?.status === "delivered" ||
      m?.status === "failed" ||
      m?.status === "pending"
        ? m.status
        : "pending",
    timestamp: m?.timestamp ?? "",
    sentBy: m?.sentBy ?? "",
  };
}

function normalizeTemplate(
  t: Partial<MessageTemplate> | null | undefined,
): MessageTemplate {
  const id =
    t?.id || `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    name: t?.name ?? "",
    type: t?.type === "email" ? t.type : "sms",
    subject: t?.subject,
    content: t?.content ?? "",
    category: t?.category ?? "general",
  };
}

function normalizeContacts(arr: unknown): Contact[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((c) => normalizeContact(c as Partial<Contact>));
}

function normalizeMessages(arr: unknown): Message[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((m) => normalizeMessage(m as Partial<Message>));
}

function normalizeTemplates(arr: unknown): MessageTemplate[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((t) => normalizeTemplate(t as Partial<MessageTemplate>));
}

export default function Communication() {
  const { user } = useAuth();
  const { currentStation } = useStations();
  const stationId = currentStation?.id;
  const { state } = useFuel();

  // State management — initialize from the synchronous cache so the FIRST
  // render shows data instantly (no blank flash while the async cloud get
  // resolves).
  const [activeTab, setActiveTab] = useState<
    "contacts" | "messages" | "templates"
  >("contacts");
  const [contacts, setContacts] = useState<Contact[]>(() => {
    const cached = cloudStorageService.getCached<unknown[]>(
      "comm_contacts",
      stationId,
    );
    return Array.isArray(cached) ? normalizeContacts(cached) : [];
  });
  const [messages, setMessages] = useState<Message[]>(() => {
    const cached = cloudStorageService.getCached<unknown[]>(
      "comm_messages",
      stationId,
    );
    return Array.isArray(cached) ? normalizeMessages(cached) : [];
  });
  const [templates, setTemplates] = useState<MessageTemplate[]>(() => {
    const cached = cloudStorageService.getCached<unknown[]>(
      "comm_templates",
      stationId,
    );
    return Array.isArray(cached) ? normalizeTemplates(cached) : [];
  });

  // UI state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTag, setFilterTag] = useState<string>("all");
  const [showContactModal, setShowContactModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);

  // Form state
  const [contactForm, setContactForm] = useState({
    name: "",
    phone: "",
    email: "",
    company: "",
    tags: "",
    balance: 0,
    notes: "",
  });

  const [messageForm, setMessageForm] = useState({
    type: "sms" as "sms" | "email",
    subject: "",
    content: "",
    recipients: [] as string[],
  });

  const [templateForm, setTemplateForm] = useState({
    name: "",
    type: "sms" as "sms" | "email",
    subject: "",
    content: "",
    category: "general",
  });

  // CRITICAL: cloud-load race guard. Without this, a save/delete fired
  // BEFORE the initial cloud load completes reads an empty/default state
  // and writes it back to cloud, wiping ALL the user's data on a fresh
  // device. Same class of bug fixed in FuelContext + PayrollSystem.
  const cloudLoadCompleteRef = useRef(false);
  // Refs to the latest contacts/messages/templates so save/delete functions
  // operate on the CURRENT state (not a stale re-fetch that may return []
  // before load completes).
  const contactsRef = useRef<Contact[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const templatesRef = useRef<MessageTemplate[]>([]);
  contactsRef.current = contacts;
  messagesRef.current = messages;
  templatesRef.current = templates;

  // Reset the load-complete guard on user/station change so a fresh load
  // is required before any save is allowed.
  useEffect(() => {
    cloudLoadCompleteRef.current = false;
  }, [user, stationId]);

  // Load data from backend + real-time cross-device sync
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    // Load all three collections; mark load complete only after ALL resolve
    // so no save can fire against an empty (pre-load) state.
    Promise.all([loadContacts(), loadMessages(), loadTemplates()]).finally(
      () => {
        if (!cancelled) cloudLoadCompleteRef.current = true;
      },
    );

    // Real-time: when another device updates contacts/messages/templates, update instantly
    const unsubs = [
      cloudStorageService.subscribe<Contact[]>(
        "comm_contacts",
        stationId,
        (val) => {
          setContacts(normalizeContacts(val));
        },
      ),
      cloudStorageService.subscribe<Message[]>(
        "comm_messages",
        stationId,
        (val) => {
          setMessages(normalizeMessages(val));
        },
      ),
      cloudStorageService.subscribe<MessageTemplate[]>(
        "comm_templates",
        stationId,
        (val) => {
          setTemplates(normalizeTemplates(val));
        },
      ),
    ];
    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, [user, stationId]);

  // Auto-refresh messages every 30 seconds for live updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (user && activeTab === "messages") {
        loadMessages();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [user, activeTab]);

  const loadContacts = async () => {
    try {
      const data = await cloudStorageService.get<Contact[]>(
        "comm_contacts",
        stationId,
      );
      setContacts(normalizeContacts(data));
    } catch (error) {
      console.error("Error loading contacts:", error);
    }
  };

  const loadMessages = async () => {
    try {
      const data = await cloudStorageService.get<Message[]>(
        "comm_messages",
        stationId,
      );
      setMessages(normalizeMessages(data));
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const loadTemplates = async () => {
    try {
      const data = await cloudStorageService.get<MessageTemplate[]>(
        "comm_templates",
        stationId,
      );
      setTemplates(normalizeTemplates(data));
    } catch (error) {
      console.error("Error loading templates:", error);
    }
  };

  const saveContact = async () => {
    // Validation: require at least a name.
    if (!contactForm.name.trim()) {
      alert("Contact name is required.");
      return;
    }
    // Guard: don't save before the initial cloud load completes (would wipe).
    if (!cloudLoadCompleteRef.current) {
      alert(
        "Still loading your contacts from cloud. Please try again in a moment.",
      );
      return;
    }
    try {
      const tags = contactForm.tags
        ? typeof contactForm.tags === "string"
          ? contactForm.tags
              .split(",")
              .map((t) => t.trim())
              .filter((t) => t)
          : contactForm.tags
        : [];

      const newContact: Contact = {
        // Add random suffix to avoid ID collision on rapid double-save.
        id:
          selectedContact?.id ||
          `ct_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: contactForm.name.trim(),
        phone: contactForm.phone.trim(),
        email: contactForm.email.trim(),
        company: contactForm.company.trim(),
        tags: tags as string[],
        balance:
          typeof (contactForm as any).balance === "number"
            ? (contactForm as any).balance
            : 0,
        lastContact: selectedContact?.lastContact || new Date().toISOString(),
        notes: contactForm.notes || "",
        starred: selectedContact?.starred || false,
      };

      // Operate on the LATEST state (ref), not a stale re-fetch.
      const existing = contactsRef.current;
      let updated: Contact[];
      if (selectedContact) {
        updated = existing.map((c) =>
          c.id === selectedContact.id ? { ...c, ...newContact } : c,
        );
      } else {
        updated = [...existing, newContact];
      }
      await cloudStorageService.set("comm_contacts", updated, stationId);
      setContacts(updated);
      setShowContactModal(false);
      setSelectedContact(null);
      resetContactForm();
      import("@/react-app/lib/toast").then(({ toastSuccess }) =>
        toastSuccess("Contact saved"),
      );
    } catch (error) {
      console.error("Error saving contact:", error);
      alert("Failed to save contact: " + (error as Error).message);
    }
  };

  const deleteContact = async (id: string) => {
    if (!confirm("Delete this contact? Related messages will also be deleted."))
      return;
    if (!cloudLoadCompleteRef.current) {
      alert("Still loading from cloud. Please try again in a moment.");
      return;
    }

    try {
      // Delete the contact + orphaned messages (cascade).
      const updatedContacts = contactsRef.current.filter((c) => c.id !== id);
      const updatedMessages = messagesRef.current.filter(
        (m) => m.contactId !== id,
      );
      await cloudStorageService.set(
        "comm_contacts",
        updatedContacts,
        stationId,
      );
      await cloudStorageService.set(
        "comm_messages",
        updatedMessages,
        stationId,
      );
      setContacts(updatedContacts);
      setMessages(updatedMessages);
      import("@/react-app/lib/toast").then(({ toastSuccess }) =>
        toastSuccess("Contact deleted"),
      );
    } catch (error) {
      console.error("Error deleting contact:", error);
      alert("Failed to delete contact: " + (error as Error).message);
    }
  };

  const sendMessage = async () => {
    // Validation: require content + at least one recipient.
    if (!messageForm.content.trim()) {
      alert("Message content is required.");
      return;
    }
    const recipients =
      selectedContacts.length > 0 ? selectedContacts : messageForm.recipients;
    if (!recipients || recipients.length === 0) {
      alert("Please select at least one recipient.");
      return;
    }
    if (!cloudLoadCompleteRef.current) {
      alert("Still loading from cloud. Please try again in a moment.");
      return;
    }
    try {
      // Create one message per recipient (bulk send was ignoring all but the first).
      const now = new Date().toISOString();
      const sentBy = user?.email || user?.id || "user";
      const newMessages: Message[] = recipients.map((rid, idx) => ({
        id: `msg_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 8)}`,
        contactId: rid,
        type: messageForm.type || "sms",
        content: messageForm.content || "",
        subject: messageForm.subject || "",
        // Status is "pending" — the message is stored, not actually sent via a
        // gateway. The previous "sent" status was misleading.
        status: "pending",
        timestamp: now,
        sentBy,
      }));
      const updated = [...newMessages, ...messagesRef.current];
      await cloudStorageService.set("comm_messages", updated, stationId);
      setMessages(updated);
      setShowMessageModal(false);
      setSelectedContacts([]);
      resetMessageForm();
      import("@/react-app/lib/toast").then(({ toastSuccess }) =>
        toastSuccess(
          `Message queued for ${recipients.length} recipient(s). Configure an SMS/email gateway in Integration Hub to actually send.`,
        ),
      );
    } catch (error) {
      console.error("Error sending message:", error);
      import("@/react-app/lib/toast").then(({ toastError }) =>
        toastError("Error sending message: " + (error as Error).message),
      );
    }
  };

  const deleteMessage = async (id: string) => {
    if (!confirm("Delete this message?")) return;
    if (!cloudLoadCompleteRef.current) {
      alert("Still loading from cloud. Please try again in a moment.");
      return;
    }
    try {
      const updated = messagesRef.current.filter((m) => m.id !== id);
      await cloudStorageService.set("comm_messages", updated, stationId);
      setMessages(updated);
      import("@/react-app/lib/toast").then(({ toastSuccess }) =>
        toastSuccess("Message deleted"),
      );
    } catch (error) {
      console.error("Error deleting message:", error);
      alert("Failed to delete message: " + (error as Error).message);
    }
  };

  const saveTemplate = async () => {
    if (!templateForm.name.trim()) {
      alert("Template name is required.");
      return;
    }
    if (!templateForm.content.trim()) {
      alert("Template content is required.");
      return;
    }
    if (!cloudLoadCompleteRef.current) {
      alert("Still loading from cloud. Please try again in a moment.");
      return;
    }
    try {
      const existing = templatesRef.current;
      // If editing (a template with a matching id was selected), update; else add.
      const editingId = (templateForm as any)._editingId;
      const newTemplate: MessageTemplate = {
        id:
          editingId ||
          `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: templateForm.name.trim(),
        type: templateForm.type || "sms",
        subject: templateForm.subject || "",
        content: templateForm.content.trim(),
        category: templateForm.category || "general",
      };
      let updated: MessageTemplate[];
      if (editingId) {
        updated = existing.map((t) =>
          t.id === editingId ? { ...t, ...newTemplate } : t,
        );
      } else {
        updated = [...existing, newTemplate];
      }
      await cloudStorageService.set("comm_templates", updated, stationId);
      setTemplates(updated);
      setShowTemplateModal(false);
      resetTemplateForm();
      import("@/react-app/lib/toast").then(({ toastSuccess }) =>
        toastSuccess("Template saved"),
      );
    } catch (error) {
      console.error("Error saving template:", error);
      alert("Failed to save template: " + (error as Error).message);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    if (!cloudLoadCompleteRef.current) {
      alert("Still loading from cloud. Please try again in a moment.");
      return;
    }

    try {
      const updated = templatesRef.current.filter((t) => t.id !== id);
      await cloudStorageService.set("comm_templates", updated, stationId);
      setTemplates(updated);
      import("@/react-app/lib/toast").then(({ toastSuccess }) =>
        toastSuccess("Template deleted"),
      );
    } catch (error) {
      console.error("Error deleting template:", error);
      alert("Failed to delete template: " + (error as Error).message);
    }
  };

  const toggleStarContact = async (contact: Contact) => {
    if (!cloudLoadCompleteRef.current) return;
    try {
      const existing = contactsRef.current;
      const updated = existing.map((c) =>
        c.id === contact.id ? { ...c, starred: !c.starred } : c,
      );
      await cloudStorageService.set("comm_contacts", updated, stationId);
      setContacts(updated);
    } catch (error) {
      console.error("Error updating contact:", error);
    }
  };

  const exportContactsCSV = () => {
    if (contacts.length === 0) {
      alert("No contacts to export.");
      return;
    }
    const escape = (val: string) => `"${String(val).replace(/"/g, '""')}"`;
    const headers = [
      "Name",
      "Phone",
      "Email",
      "Company",
      "Tags",
      "Balance",
      "Notes",
      "Starred",
    ];
    const rows = contacts.map((c) => [
      c.name,
      c.phone,
      c.email,
      c.company,
      (c.tags || []).join("; "),
      String(c.balance || 0),
      c.notes || "",
      c.starred ? "Yes" : "No",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map(escape).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contacts_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const applyTemplate = (template: MessageTemplate) => {
    setMessageForm({
      type: template.type,
      subject: template.subject || "",
      content: template.content,
      recipients: selectedContacts,
    });
    setShowTemplateModal(false);
    setShowMessageModal(true);
  };

  const resetContactForm = () => {
    setContactForm({
      name: "",
      phone: "",
      email: "",
      company: "",
      tags: "",
      balance: 0,
      notes: "",
    });
  };

  const resetMessageForm = () => {
    setMessageForm({
      type: "sms",
      subject: "",
      content: "",
      recipients: [],
    });
  };

  const resetTemplateForm = () => {
    setTemplateForm({
      name: "",
      type: "sms",
      subject: "",
      content: "",
      category: "general",
    });
    // Clear the hidden editing-id flag.
    (templateForm as any)._editingId = undefined;
  };

  const openEditTemplate = (template: MessageTemplate) => {
    setTemplateForm({
      name: template.name,
      type: template.type,
      subject: template.subject || "",
      content: template.content,
      category: template.category,
    } as any);
    // Stash the id so saveTemplate knows to update instead of insert.
    (templateForm as any)._editingId = template.id;
    setShowTemplateModal(true);
  };

  const openEditContact = (contact: Contact) => {
    setSelectedContact(contact);
    setContactForm({
      name: contact.name,
      phone: contact.phone,
      email: contact.email,
      company: contact.company,
      tags: (contact.tags || []).join(", "),
      balance: contact.balance,
      notes: contact.notes,
    });
    setShowContactModal(true);
  };

  const openNewMessage = (contactIds?: string[]) => {
    if (contactIds && contactIds.length > 0) {
      setSelectedContacts(contactIds);
      setMessageForm((prev) => ({ ...prev, recipients: contactIds }));
    }
    setShowMessageModal(true);
  };

  // Filter contacts
  const filteredContacts = contacts.filter((contact) => {
    const matchesSearch =
      (contact.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (contact.phone || "").includes(searchTerm) ||
      (contact.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (contact.company || "").toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTag =
      filterTag === "all" ||
      (filterTag === "starred" && contact.starred) ||
      (contact.tags || []).includes(filterTag);

    return matchesSearch && matchesTag;
  });

  // Get all unique tags
  const allTags = Array.from(new Set(contacts.flatMap((c) => c.tags || [])));

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
      case "delivered":
        return <CheckCircle size={16} className="text-green-500" />;
      case "failed":
        return <XCircle size={16} className="text-red-500" />;
      case "pending":
        return <Clock size={16} className="text-yellow-500" />;
      default:
        return null;
    }
  };

  // Render contacts tab
  const renderContactsTab = () => (
    <div className="space-y-4">
      {/* Header with search and actions */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="flex-1 w-full md:w-auto">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={20}
            />
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
            />
          </div>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <select
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
          >
            <option value="all">All Tags</option>
            <option value="starred">Starred</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              resetContactForm();
              setSelectedContact(null);
              setShowContactModal(true);
            }}
            className="btn btn-primary px-4 py-2 flex items-center gap-2"
          >
            <Plus size={20} />
            Add Contact
          </button>
          <button
            onClick={exportContactsCSV}
            disabled={contacts.length === 0}
            className="btn px-4 py-2 flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50"
            title="Export contacts as CSV"
          >
            <Download size={18} />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Bulk actions */}
      {selectedContacts.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg flex justify-between items-center">
          <span className="font-medium">
            {selectedContacts.length} contact
            {selectedContacts.length > 1 ? "s" : ""} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => openNewMessage(selectedContacts)}
              className="btn btn-primary px-4 py-2 flex items-center gap-2"
            >
              <Send size={16} />
              Send Message
            </button>
            <button
              onClick={() => setSelectedContacts([])}
              className="btn btn-outline px-4 py-2"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Contacts grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredContacts.map((contact) => (
          <div
            key={contact.id}
            className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedContacts.includes(contact.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedContacts([...selectedContacts, contact.id]);
                    } else {
                      setSelectedContacts(
                        selectedContacts.filter((id) => id !== contact.id),
                      );
                    }
                  }}
                  className="w-4 h-4"
                />
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <User
                    size={20}
                    className="text-blue-600 dark:text-blue-400"
                  />
                </div>
              </div>
              <button
                onClick={() => toggleStarContact(contact)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <Star
                  size={18}
                  className={
                    contact.starred
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-400"
                  }
                />
              </button>
            </div>

            <h3 className="font-semibold text-lg mb-1">{contact.name}</h3>
            {contact.company && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                {contact.company}
              </p>
            )}

            <div className="space-y-1 mb-3 text-sm">
              {contact.phone && (
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <Phone size={14} />
                  {contact.phone}
                </div>
              )}
              {contact.email && (
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <Mail size={14} />
                  {contact.email}
                </div>
              )}
            </div>

            {(contact.tags || []).length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {(contact.tags || []).map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {contact.balance !== 0 && (
              <div
                className={`text-sm font-medium mb-3 ${contact.balance > 0 ? "text-red-600" : "text-green-600"}`}
              >
                Balance: {state.companyData.currency}{" "}
                {Math.abs(contact.balance || 0).toLocaleString()}
                {contact.balance > 0 ? " (Owed)" : " (Credit)"}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => openNewMessage([contact.id])}
                className="flex-1 btn btn-primary py-2 flex items-center justify-center gap-2 text-sm"
              >
                <Send size={16} />
                Message
              </button>
              <button
                onClick={() => openEditContact(contact)}
                className="btn btn-outline p-2"
              >
                <Edit size={16} />
              </button>
              <button
                onClick={() => deleteContact(contact.id)}
                className="btn btn-outline p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredContacts.length === 0 && (
        <div className="text-center py-12">
          <Users size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">No contacts found</p>
        </div>
      )}
    </div>
  );

  // Render messages tab
  const renderMessagesTab = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold">Communication History</h3>
        <button
          onClick={() => openNewMessage()}
          className="btn btn-primary px-4 py-2 flex items-center gap-2"
        >
          <Plus size={20} />
          New Message
        </button>
      </div>

      <div className="space-y-2">
        {messages.map((message) => {
          const contact = contacts.find((c) => c.id === message.contactId);
          return (
            <div
              key={message.id}
              className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow border border-gray-200 dark:border-gray-700"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-3">
                  {message.type === "sms" && (
                    <MessageSquare size={20} className="text-blue-500" />
                  )}
                  {message.type === "email" && (
                    <Mail size={20} className="text-green-500" />
                  )}
                  {message.type === "call" && (
                    <Phone size={20} className="text-purple-500" />
                  )}
                  <div>
                    <h4 className="font-semibold">
                      {contact?.name || "Unknown"}
                    </h4>
                    {message.subject && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {message.subject}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(message.status)}
                  <span className="text-xs text-gray-500">
                    {new Date(message.timestamp || "").toLocaleString()}
                  </span>
                  <button
                    onClick={() => deleteMessage(message.id)}
                    className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 p-1 rounded ml-1"
                    title="Delete message"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                {message.content}
              </p>
              <div className="flex justify-between items-center text-xs text-gray-500">
                <span>Sent by: {message.sentBy}</span>
                <span className="capitalize">{message.status}</span>
              </div>
            </div>
          );
        })}
      </div>

      {messages.length === 0 && (
        <div className="text-center py-12">
          <MessageCircleMore size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">No messages yet</p>
          <button
            onClick={() => openNewMessage()}
            className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            <Plus size={16} /> New Message
          </button>
        </div>
      )}
    </div>
  );

  // Render templates tab
  const renderTemplatesTab = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold">Message Templates</h3>
        <button
          onClick={() => {
            resetTemplateForm();
            setShowTemplateModal(true);
          }}
          className="btn btn-primary px-4 py-2 flex items-center gap-2"
        >
          <Plus size={20} />
          Create Template
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((template) => (
          <div
            key={template.id}
            className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow border border-gray-200 dark:border-gray-700"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <h4 className="font-semibold">{template.name}</h4>
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                  {(template.type || "").toUpperCase()}
                </span>
                <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 rounded ml-2">
                  {template.category}
                </span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => openEditTemplate(template)}
                  className="text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 p-1 rounded"
                  title="Edit template"
                >
                  <Edit size={16} />
                </button>
                <button
                  onClick={() => deleteTemplate(template.id)}
                  className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 p-1 rounded"
                  title="Delete template"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {template.subject && (
              <p className="text-sm font-medium mb-1">
                Subject: {template.subject}
              </p>
            )}
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
              {template.content}
            </p>

            <button
              onClick={() => applyTemplate(template)}
              className="w-full btn btn-primary py-2 flex items-center justify-center gap-2"
            >
              <Send size={16} />
              Use Template
            </button>
          </div>
        ))}
      </div>

      {templates.length === 0 && (
        <div className="text-center py-12">
          <Archive size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">No templates created yet</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab("contacts")}
          className={`px-6 py-3 font-medium ${
            activeTab === "contacts"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-600 dark:text-gray-400"
          }`}
        >
          <Users size={20} className="inline mr-2" />
          Contacts ({contacts.length})
        </button>
        <button
          onClick={() => setActiveTab("messages")}
          className={`px-6 py-3 font-medium ${
            activeTab === "messages"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-600 dark:text-gray-400"
          }`}
        >
          <MessageSquare size={20} className="inline mr-2" />
          Messages ({messages.length})
        </button>
        <button
          onClick={() => setActiveTab("templates")}
          className={`px-6 py-3 font-medium ${
            activeTab === "templates"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-600 dark:text-gray-400"
          }`}
        >
          <Archive size={20} className="inline mr-2" />
          Templates ({templates.length})
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "contacts" && renderContactsTab()}
      {activeTab === "messages" && renderMessagesTab()}
      {activeTab === "templates" && renderTemplatesTab()}

      {/* Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">
              {selectedContact ? "Edit Contact" : "Add New Contact"}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={contactForm.name}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, name: e.target.value })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>Phone *</label>
                <input
                  type="tel"
                  value={contactForm.phone}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, phone: e.target.value })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={contactForm.email}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, email: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label>Company</label>
                <input
                  type="text"
                  value={contactForm.company}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, company: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label>Tags (comma-separated)</label>
                <input
                  type="text"
                  value={contactForm.tags}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, tags: e.target.value })
                  }
                  placeholder="customer, vip, dealer"
                />
              </div>

              <div className="form-group">
                <label>Balance</label>
                <input
                  type="number"
                  value={contactForm.balance}
                  onChange={(e) =>
                    setContactForm({
                      ...contactForm,
                      balance: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>

            <div className="form-group mt-4">
              <label>Notes</label>
              <textarea
                value={contactForm.notes}
                onChange={(e) =>
                  setContactForm({ ...contactForm, notes: e.target.value })
                }
                rows={3}
              />
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={() => {
                  setShowContactModal(false);
                  setSelectedContact(null);
                }}
                className="btn btn-outline"
              >
                Cancel
              </button>
              <button onClick={saveContact} className="btn btn-primary">
                Save Contact
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message Modal */}
      {showMessageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Send Message</h3>

            <div className="space-y-4">
              <div className="form-group">
                <label>Message Type</label>
                <select
                  value={messageForm.type}
                  onChange={(e) =>
                    setMessageForm({
                      ...messageForm,
                      type: e.target.value as "sms" | "email",
                    })
                  }
                >
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                </select>
              </div>

              {messageForm.type === "email" && (
                <div className="form-group">
                  <label>Subject</label>
                  <input
                    type="text"
                    value={messageForm.subject}
                    onChange={(e) =>
                      setMessageForm({
                        ...messageForm,
                        subject: e.target.value,
                      })
                    }
                  />
                </div>
              )}

              <div className="form-group">
                <label>Message Content</label>
                <textarea
                  value={messageForm.content}
                  onChange={(e) =>
                    setMessageForm({ ...messageForm, content: e.target.value })
                  }
                  rows={6}
                  placeholder="Type your message here..."
                />
                {messageForm.type === "sms" && (
                  <p className="text-xs text-gray-500 mt-1">
                    {messageForm.content.length} characters
                  </p>
                )}
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
                <p className="text-sm">
                  Recipients:{" "}
                  {selectedContacts.length > 0
                    ? `${selectedContacts.length} contact(s) selected`
                    : "No recipients selected"}
                </p>
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={() => {
                  setShowMessageModal(false);
                  setSelectedContacts([]);
                }}
                className="btn btn-outline"
              >
                Cancel
              </button>
              <button
                onClick={sendMessage}
                disabled={!messageForm.content || selectedContacts.length === 0}
                className="btn btn-primary flex items-center gap-2"
              >
                <Send size={20} />
                Send Message
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Create Message Template</h3>

            <div className="space-y-4">
              <div className="form-group">
                <label>Template Name</label>
                <input
                  type="text"
                  value={templateForm.name}
                  onChange={(e) =>
                    setTemplateForm({ ...templateForm, name: e.target.value })
                  }
                  placeholder="e.g., Payment Reminder"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label>Type</label>
                  <select
                    value={templateForm.type}
                    onChange={(e) =>
                      setTemplateForm({
                        ...templateForm,
                        type: e.target.value as "sms" | "email",
                      })
                    }
                  >
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={templateForm.category}
                    onChange={(e) =>
                      setTemplateForm({
                        ...templateForm,
                        category: e.target.value,
                      })
                    }
                  >
                    <option value="general">General</option>
                    <option value="payment">Payment</option>
                    <option value="reminder">Reminder</option>
                    <option value="promotional">Promotional</option>
                  </select>
                </div>
              </div>

              {templateForm.type === "email" && (
                <div className="form-group">
                  <label>Subject</label>
                  <input
                    type="text"
                    value={templateForm.subject}
                    onChange={(e) =>
                      setTemplateForm({
                        ...templateForm,
                        subject: e.target.value,
                      })
                    }
                  />
                </div>
              )}

              <div className="form-group">
                <label>Template Content</label>
                <textarea
                  value={templateForm.content}
                  onChange={(e) =>
                    setTemplateForm({
                      ...templateForm,
                      content: e.target.value,
                    })
                  }
                  rows={6}
                  placeholder="Dear [Name], ..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use [Name], [Company], [Balance] as placeholders
                </p>
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={() => setShowTemplateModal(false)}
                className="btn btn-outline"
              >
                Cancel
              </button>
              <button onClick={saveTemplate} className="btn btn-primary">
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
