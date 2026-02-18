"use client";

import { useEffect, useState } from "react";
import supabase from "@/lib/supabase";

interface AdminMessage {
  id: number;
  from_user_id: string;
  to_user_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  from_username?: string;
  to_username?: string;
}

interface AdminMessageModalProps {
  otherUserId: string;
  otherUserName: string;
  onClose: () => void;
  onNotificationsClearedProp?: () => void;
}

export default function AdminMessageModal({ otherUserId, otherUserName, onClose, onNotificationsClearedProp }: AdminMessageModalProps) {
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const loadMessages = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;
        
        setCurrentUserId(userData.user.id);

        // Clear admin message notifications when viewing conversation
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData.session?.access_token;
          if (token) {
            const clearResponse = await fetch("/api/notifications", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                type: "admin_message",
              }),
            });
            
            if (clearResponse.ok) {
              console.log("Admin message notifications cleared");
              // Trigger notification badge refresh
              if (onNotificationsClearedProp) {
                onNotificationsClearedProp();
              }
            } else {
              console.error("Failed to clear notifications:", await clearResponse.text());
            }
          }
        } catch (error) {
          console.error("Failed to clear notifications:", error);
        }

        // Check if current user is admin
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", userData.user.id)
          .single();
        
        setIsAdmin(profile?.is_admin || false);

        // Load admin messages between current user and other user
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;

        const res = await fetch("/api/messages/list", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          const { messages: allMessages } = await res.json();
          
          // Filter for all messages between current user and other user (no listing_id)
          const adminMessages = allMessages?.filter((msg: {
            content?: string;
            from_user_id: string;
            to_user_id: string;
            listing_id?: number | null;
          }) => 
            ((msg.from_user_id === userData.user.id && msg.to_user_id === otherUserId) ||
             (msg.from_user_id === otherUserId && msg.to_user_id === userData.user.id)) &&
            !msg.listing_id
          ) || [];

          setMessages(adminMessages.sort((a: { created_at: string }, b: { created_at: string }) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          ));
        }
      } catch (error) {
        console.error("Failed to load admin messages:", error);
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [otherUserId, onNotificationsClearedProp]);

  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;

      const messageContent = isAdmin ? `[ADMIN] ${newMessage.trim()}` : newMessage.trim();

      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          to_user_id: otherUserId,
          content: messageContent,
        }),
      });

      if (res.ok) {
        setNewMessage("");
        // Refresh messages
        window.location.reload(); // Simple reload for now
      } else {
        const error = await res.json();
        alert(`Failed to send message: ${error.error}`);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      alert("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = async (messageId: number) => {
    if (!isAdmin) return;
    
    if (!confirm("Delete this message? This cannot be undone.")) return;

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;

      // We'll need to create a delete message API endpoint
      const res = await fetch("/api/messages/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messageId }),
      });

      if (res.ok) {
        setMessages(messages.filter(msg => msg.id !== messageId));
      } else {
        alert("Failed to delete message");
      }
    } catch (error) {
      console.error("Failed to delete message:", error);
      alert("Failed to delete message");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-foreground/10">
          <div>
            <h2 className="text-lg font-semibold">Admin Messages</h2>
            <p className="text-sm text-foreground/60">Conversation with {otherUserName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-foreground/60 hover:text-foreground text-xl font-bold w-8 h-8 flex items-center justify-center rounded hover:bg-foreground/5"
          >
            ×
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <p className="text-center text-foreground/60">Loading messages...</p>
          ) : messages.length === 0 ? (
            <p className="text-center text-foreground/60">No messages yet</p>
          ) : (
            messages.map((message) => {
              const isCurrentUser = message.from_user_id === currentUserId;
              const isAdminMessage = message.content.startsWith('[ADMIN]');
              
              return (
                <div key={message.id} className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg relative group ${
                    isCurrentUser 
                      ? 'bg-blue-500 text-white' 
                      : isAdminMessage 
                        ? 'bg-purple-500/10 border border-purple-500/20 text-foreground'
                        : 'bg-foreground/10 text-foreground'
                  }`}>
                    {isAdminMessage && !isCurrentUser && (
                      <div className="text-xs font-medium text-purple-600 mb-1">ADMIN</div>
                    )}
                    <p className="text-sm">{
                      isAdminMessage 
                        ? message.content.replace('[ADMIN] ', '') 
                        : message.content
                    }</p>
                    <div className={`text-xs mt-1 ${isCurrentUser ? 'text-blue-100' : 'text-foreground/50'}`}>
                      {new Date(message.created_at).toLocaleTimeString()}
                    </div>
                    
                    {/* Delete button for admins */}
                    {isAdmin && (
                      <button
                        onClick={() => deleteMessage(message.id)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Message Input */}
        <div className="p-4 border-t border-foreground/10">
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder={isAdmin ? "Type admin message..." : "Type your reply..."}
              className="flex-1 px-3 py-2 border border-foreground/20 rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? "..." : "Send"}
            </button>
          </div>
          {isAdmin && (
            <p className="text-xs text-foreground/60 mt-1">Messages will be prefixed with [ADMIN]</p>
          )}
        </div>
      </div>
    </div>
  );
}