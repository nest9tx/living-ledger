"use client";

import { useEffect, useState, useRef } from "react";
import supabase from "@/lib/supabase";

type Message = {
  id: number;
  from_user_id: string;
  to_user_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    if (!newMessage.trim() || !currentUserId) return;

    setSending(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

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
        }),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || "Failed to send message");
      }

      const { message } = await response.json();
      
      // Add message to local state
      setMessages((prev) => [...prev, message]);
      setNewMessage("");
    } catch (err) {
      console.error("Error sending message:", err);
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
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
                  <p className="text-sm">{message.content}</p>
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
      <form onSubmit={handleSendMessage} className="border-t border-foreground/10 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm focus:border-foreground/40 focus:outline-none"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !newMessage.trim()}
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
