import { useState, useEffect } from "react";
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
} from "lucide-react";
import { useFuel } from "@/react-app/context/FuelContext";
import { useAuth } from "@/react-app/context/AuthContext";

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

export default function Communication() {
  const { user } = useAuth();
  const { state } = useFuel();

  // State management
  const [activeTab, setActiveTab] = useState<
    "contacts" | "messages" | "templates"
  >("contacts");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);

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

  // Load data from backend
  useEffect(() => {
    if (user) {
      loadContacts();
      loadMessages();
      loadTemplates();
    }
  }, [user]);

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
      const response = await fetch("/api/communication/contacts", {
        headers: { Authorization: `Bearer ${user?.id}` },
      });

      if (response.ok) {
        const data = await response.json();
        setContacts(data.contacts || []);
      }
    } catch (error) {
      console.error("Error loading contacts:", error);
    }
  };

  const loadMessages = async () => {
    try {
      const response = await fetch("/api/communication/messages", {
        headers: { Authorization: `Bearer ${user?.id}` },
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await fetch("/api/communication/templates", {
        headers: { Authorization: `Bearer ${user?.id}` },
      });

      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error("Error loading templates:", error);
    }
  };

  const saveContact = async () => {
    try {
      const method = selectedContact ? "PUT" : "POST";
      const url = selectedContact
        ? `/api/communication/contacts/${selectedContact.id}`
        : "/api/communication/contacts";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user?.id}`,
        },
        body: JSON.stringify({
          ...contactForm,
          tags: contactForm.tags
            .split(",")
            .map(t => t.trim())
            .filter(t => t),
        }),
      });

      if (response.ok) {
        await loadContacts();
        setShowContactModal(false);
        setSelectedContact(null);
        resetContactForm();
      }
    } catch (error) {
      console.error("Error saving contact:", error);
    }
  };

  const deleteContact = async (id: string) => {
    if (!confirm("Delete this contact?")) return;

    try {
      const response = await fetch(`/api/communication/contacts/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${user?.id}` },
      });

      if (response.ok) {
        await loadContacts();
      }
    } catch (error) {
      console.error("Error deleting contact:", error);
    }
  };

  const sendMessage = async () => {
    try {
      const response = await fetch("/api/communication/send-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user?.id}`,
        },
        body: JSON.stringify({
          ...messageForm,
          recipients:
            selectedContacts.length > 0
              ? selectedContacts
              : messageForm.recipients,
        }),
      });

      if (response.ok) {
        await loadMessages();
        setShowMessageModal(false);
        setSelectedContacts([]);
        resetMessageForm();
        import("@/react-app/lib/toast").then(({ toastSuccess }) =>
          toastSuccess("Message sent successfully!")
        );
      } else {
        import("@/react-app/lib/toast").then(({ toastError }) =>
          toastError("Failed to send message. Please try again.")
        );
      }
    } catch (error) {
      console.error("Error sending message:", error);
      import("@/react-app/lib/toast").then(({ toastError }) =>
        toastError("Error sending message. Please check your connection.")
      );
    }
  };

  const saveTemplate = async () => {
    try {
      const method = "POST";
      const url = "/api/communication/templates";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user?.id}`,
        },
        body: JSON.stringify(templateForm),
      });

      if (response.ok) {
        await loadTemplates();
        setShowTemplateModal(false);
        resetTemplateForm();
      }
    } catch (error) {
      console.error("Error saving template:", error);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("Delete this template?")) return;

    try {
      const response = await fetch(`/api/communication/templates/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${user?.id}` },
      });

      if (response.ok) {
        await loadTemplates();
      }
    } catch (error) {
      console.error("Error deleting template:", error);
    }
  };

  const toggleStarContact = async (contact: Contact) => {
    try {
      const response = await fetch(
        `/api/communication/contacts/${contact.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user?.id}`,
          },
          body: JSON.stringify({
            ...contact,
            starred: !contact.starred,
          }),
        }
      );

      if (response.ok) {
        await loadContacts();
      }
    } catch (error) {
      console.error("Error updating contact:", error);
    }
  };

  const useTemplate = (template: MessageTemplate) => {
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
  };

  const openEditContact = (contact: Contact) => {
    setSelectedContact(contact);
    setContactForm({
      name: contact.name,
      phone: contact.phone,
      email: contact.email,
      company: contact.company,
      tags: contact.tags.join(", "),
      balance: contact.balance,
      notes: contact.notes,
    });
    setShowContactModal(true);
  };

  const openNewMessage = (contactIds?: string[]) => {
    if (contactIds && contactIds.length > 0) {
      setSelectedContacts(contactIds);
      setMessageForm(prev => ({ ...prev, recipients: contactIds }));
    }
    setShowMessageModal(true);
  };

  // Filter contacts
  const filteredContacts = contacts.filter(contact => {
    const matchesSearch =
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.phone.includes(searchTerm) ||
      contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.company.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTag =
      filterTag === "all" ||
      (filterTag === "starred" && contact.starred) ||
      contact.tags.includes(filterTag);

    return matchesSearch && matchesTag;
  });

  // Get all unique tags
  const allTags = Array.from(new Set(contacts.flatMap(c => c.tags)));

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
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
            />
          </div>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <select
            value={filterTag}
            onChange={e => setFilterTag(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
          >
            <option value="all">All Tags</option>
            <option value="starred">Starred</option>
            {allTags.map(tag => (
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
        {filteredContacts.map(contact => (
          <div
            key={contact.id}
            className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedContacts.includes(contact.id)}
                  onChange={e => {
                    if (e.target.checked) {
                      setSelectedContacts([...selectedContacts, contact.id]);
                    } else {
                      setSelectedContacts(
                        selectedContacts.filter(id => id !== contact.id)
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

            {contact.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {contact.tags.map(tag => (
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
                {Math.abs(contact.balance).toLocaleString()}
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
        {messages.map(message => {
          const contact = contacts.find(c => c.id === message.contactId);
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
                    {new Date(message.timestamp).toLocaleString()}
                  </span>
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
        {templates.map(template => (
          <div
            key={template.id}
            className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow border border-gray-200 dark:border-gray-700"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <h4 className="font-semibold">{template.name}</h4>
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                  {template.type.toUpperCase()}
                </span>
                <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 rounded ml-2">
                  {template.category}
                </span>
              </div>
              <button
                onClick={() => deleteTemplate(template.id)}
                className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 p-1 rounded"
              >
                <Trash2 size={16} />
              </button>
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
              onClick={() => useTemplate(template)}
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
                  onChange={e =>
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
                  onChange={e =>
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
                  onChange={e =>
                    setContactForm({ ...contactForm, email: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label>Company</label>
                <input
                  type="text"
                  value={contactForm.company}
                  onChange={e =>
                    setContactForm({ ...contactForm, company: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label>Tags (comma-separated)</label>
                <input
                  type="text"
                  value={contactForm.tags}
                  onChange={e =>
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
                  onChange={e =>
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
                onChange={e =>
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
                  onChange={e =>
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
                    onChange={e =>
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
                  onChange={e =>
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
                  onChange={e =>
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
                    onChange={e =>
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
                    onChange={e =>
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
                    onChange={e =>
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
                  onChange={e =>
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
