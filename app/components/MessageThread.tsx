"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import supabase from "@/lib/supabase";

type Message = {
  id: number;
  from_user_id: string;
  to_user_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  attachment_path?: string | null;
  attachment_filename?: string | null;
  attachment_mime_type?: string | null;
  attachment_url?: string | null;
};

type MessageThreadProps = {
  listingId: number;
  listingType: "request" | "offer";
  listingOwnerId: string;
  listingTitle: string;
};

export default function MessageThread({ listingId, listingType, listingOwnerId, listingTitle }: MessageThreadProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const loadMessages = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          setError("Not authenticated");
          setLoading(false);
          return;
        }

        setCurrentUserId(userData.user.id);

        // Fetch messages for this listing
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;

        const response = await fetch(
          `/api/messages/list?listing_id=${listingId}&listing_type=${listingType}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch messages");
        }

        const { messages: fetchedMessages } = await response.json();
        setMessages(fetchedMessages);

        // Mark unread messages as read
        const unreadIds = fetchedMessages
          .filter((m: Message) => m.to_user_id === userData.user.id && !m.is_read)
          .map((m: Message) => m.id);

        if (unreadIds.length > 0) {
          await fetch("/api/messages/mark-read", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ message_ids: unreadIds }),
          });
        }
      } catch (err) {
        console.error("Error loading messages:", err);
        setError("Failed to load messages");
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [listingId, listingType]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && !pendingFile) return;
    if (!currentUserId) return;

    setSending(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      let attachmentPath: string | null = null;
      let attachmentFilename: string | null = null;
      let attachmentMimeType: string | null = null;

      // Upload file first if one is pending
      if (pendingFile) {
        setUploading(true);
        const ext = pendingFile.name.split(".").pop();
        const path = `${currentUserId}/${Date.now()}_${pendingFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("message-attachments")
          .upload(path, pendingFile, { contentType: pendingFile.type, upsert: false });

        setUploading(false);

        if (uploadError) {
          throw new Error(`File upload failed: ${uploadError.message}`);
        }

        attachmentPath = path;
        attachmentFilename = pendingFile.name;
        attachmentMimeType = pendingFile.type || (ext ? `application/${ext}` : "application/octet-stream");
      }

      const response = await fetch("/api/messages/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          to_user_id: listingOwnerId,
          content: newMessage.trim(),
          listing_id: listingId,
          listing_type: listingType,
          attachment_path: attachmentPath,
          attachment_filename: attachmentFilename,
          attachment_mime_type: attachmentMimeType,
        }),
      });

      if (!response.ok) {
        const { error: apiErr } = await response.json();
        throw new Error(apiErr || "Failed to send message");
      }

      const { message } = await response.json();

      // For image attachments, generate a local object URL for immediate display
      if (pendingFile && attachmentMimeType?.startsWith("image/")) {
        message.attachment_url = URL.createObjectURL(pendingFile);
      }

      setMessages((prev) => [...prev, message]);
      setNewMessage("");
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      console.error("Error sending message:", err);
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-sm text-foreground/60">Loading messages...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-100">
      {/* Header */}
      <div className="border-b border-foreground/10 p-4">
        <h3 className="font-semibold text-sm">Messages about: {listingTitle}</h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-foreground/60">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => {
            const isOwnMessage = message.from_user_id === currentUserId;
            const isImage = message.attachment_mime_type?.startsWith("image/");
            return (
              <div
                key={message.id}
                className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg px-4 py-2 ${
                    isOwnMessage
                      ? "bg-foreground text-background"
                      : "bg-foreground/10 text-foreground"
                  }`}
                >
                  {message.content && (
                    <p className="text-sm">{message.content}</p>
                  )}
                  {/* Attachment */}
                  {message.attachment_filename && (
                    <div className={`mt-2 ${message.content ? "border-t border-current/20 pt-2" : ""}`}>
                      {isImage && message.attachment_url ? (
                        <a href={message.attachment_url} target="_blank" rel="noopener noreferrer">
                          <Image
                            src={message.attachment_url}
                            alt={message.attachment_filename ?? "attachment"}
                            width={320}
                            height={192}
                            unoptimized
                            className="rounded-md max-h-48 object-cover w-auto"
                          />
                        </a>
                      ) : (
                        <a
                          href={message.attachment_url || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center gap-2 text-xs underline ${
                            isOwnMessage ? "text-background/80" : "text-foreground/70"
                          }`}
                        >
                          <span>📎</span>
                          <span className="truncate max-w-45">{message.attachment_filename}</span>
                        </a>
                      )}
                    </div>
                  )}
                  <p className={`text-xs mt-1 ${isOwnMessage ? "text-background/60" : "text-foreground/50"}`}>
                    {new Date(message.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error message */}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20">
          <p className="text-sm text-red-600">⚠️ {error}</p>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSendMessage} className="border-t border-foreground/10 p-4 space-y-2">
        {/* Pending file preview */}
        {pendingFile && (
          <div className="flex items-center gap-2 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2">
            <span className="text-sm">📎</span>
            <span className="flex-1 text-xs text-foreground/70 truncate">{pendingFile.name}</span>
            <button
              type="button"
              onClick={() => { setPendingFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
              className="text-xs text-foreground/50 hover:text-red-500"
            >
              ✕
            </button>
          </div>
        )}
        <div className="flex gap-2">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 10 * 1024 * 1024) {
                setError("File must be under 10 MB");
                return;
              }
              setPendingFile(file);
              setError(null);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending || uploading}
            title="Attach a file"
            className="rounded-lg border border-foreground/20 px-3 py-2 text-sm hover:bg-foreground/5 transition disabled:opacity-50"
          >
            📎
          </button>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={pendingFile ? "Add a caption (optional)" : "Type your message..."}
            className="flex-1 rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm focus:border-foreground/40 focus:outline-none"
            disabled={sending || uploading}
          />
          <button
            type="submit"
            disabled={sending || uploading || (!newMessage.trim() && !pendingFile)}
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? "Uploading..." : sending ? "Sending..." : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
