"use client";

import { useEffect, useState } from "react";
import supabase from "@/lib/supabase";
import PostDetailModal from "./PostDetailModal";

type MessageGroup = {
  listing_id: number;
  listing_type: "request" | "offer";
  listing_title: string;
  other_user_id: string;
  other_user_name: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  is_sender: boolean;
};

export default function MessagesInbox() {
  const [messageGroups, setMessageGroups] = useState<MessageGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedListing, setSelectedListing] = useState<{ id: number; type: "request" | "offer" } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const loadMessages = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          setError("Not authenticated");
          setLoading(false);
          return;
        }

        // Fetch all messages for this user
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;

        const response = await fetch("/api/messages/list", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch messages");
        }

        const { messages } = await response.json();

        const validMessages = (messages || []).filter(
          (msg: { listing_id: number | null; listing_type: string | null }) =>
            msg.listing_id && msg.listing_type
        );

        const requestIds = Array.from(
          new Set(
            validMessages
              .filter((msg: { listing_type: string }) => msg.listing_type === "request")
              .map((msg: { listing_id: number }) => msg.listing_id)
          )
        );

        const offerIds = Array.from(
          new Set(
            validMessages
              .filter((msg: { listing_type: string }) => msg.listing_type === "offer")
              .map((msg: { listing_id: number }) => msg.listing_id)
          )
        );

        const otherUserIds = Array.from(
          new Set(
            validMessages.map((msg: { from_user_id: string; to_user_id: string }) =>
              msg.from_user_id === userData.user.id ? msg.to_user_id : msg.from_user_id
            )
          )
        );

        const [requestRes, offerRes, profileRes] = await Promise.all([
          requestIds.length
            ? supabase.from("requests").select("id, title").in("id", requestIds)
            : Promise.resolve({ data: [] }),
          offerIds.length
            ? supabase.from("offers").select("id, title").in("id", offerIds)
            : Promise.resolve({ data: [] }),
          otherUserIds.length
            ? supabase.from("profiles").select("id, username").in("id", otherUserIds)
            : Promise.resolve({ data: [] }),
        ]);

        const requestMap = (requestRes.data || []).reduce((acc, row) => {
          acc[row.id] = row.title;
          return acc;
        }, {} as Record<number, string>);

        const offerMap = (offerRes.data || []).reduce((acc, row) => {
          acc[row.id] = row.title;
          return acc;
        }, {} as Record<number, string>);

        const profileMap = (profileRes.data || []).reduce((acc, row) => {
          acc[row.id] = row.username;
          return acc;
        }, {} as Record<string, string | null>);

        // Group messages by listing and conversation partner
        const grouped: Record<string, MessageGroup> = {};

        for (const msg of validMessages) {
          const otherUserId = msg.from_user_id === userData.user.id ? msg.to_user_id : msg.from_user_id;
          const key = `${msg.listing_type}-${msg.listing_id}-${otherUserId}`;

          if (!grouped[key]) {
            const listingTitle =
              msg.listing_type === "request"
                ? requestMap[msg.listing_id] || "Untitled"
                : offerMap[msg.listing_id] || "Untitled";

            grouped[key] = {
              listing_id: msg.listing_id,
              listing_type: msg.listing_type,
              listing_title: listingTitle,
              other_user_id: otherUserId,
              other_user_name: profileMap[otherUserId] || "Anonymous",
              last_message: msg.content,
              last_message_time: msg.created_at,
              unread_count: 0,
              is_sender: msg.from_user_id === userData.user.id,
            };
          }

          // Update to latest message
          if (new Date(msg.created_at) > new Date(grouped[key].last_message_time)) {
            grouped[key].last_message = msg.content;
            grouped[key].last_message_time = msg.created_at;
            grouped[key].is_sender = msg.from_user_id === userData.user.id;
          }

          // Count unread
          if (msg.to_user_id === userData.user.id && !msg.is_read) {
            grouped[key].unread_count++;
          }
        }

        const groups = Object.values(grouped).sort(
          (a, b) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime()
        );

        setMessageGroups(groups);
      } catch (err) {
        console.error("Error loading messages:", err);
        setError("Failed to load messages");
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 animate-pulse rounded bg-foreground/10" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-foreground/10" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4">
        <p className="text-sm text-red-600">⚠️ {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Messages</h2>
        <p className="text-sm text-foreground/60 mt-1">
          All your conversations in one place
        </p>
      </div>

      {messageGroups.length === 0 ? (
        <div className="rounded-lg border border-foreground/10 bg-foreground/2 p-8 text-center">
          <p className="text-sm text-foreground/60">No messages yet.</p>
          <p className="text-xs text-foreground/50 mt-2">
            Start a conversation by clicking on a listing and using the Messages tab!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {messageGroups.map((group) => (
            <div
              key={`${group.listing_type}-${group.listing_id}-${group.other_user_id}`}
              onClick={() => setSelectedListing({ id: group.listing_id, type: group.listing_type })}
              className={`rounded-lg border p-4 transition hover:border-foreground/20 hover:bg-foreground/5 cursor-pointer ${
                group.unread_count > 0
                  ? "border-blue-500/40 bg-blue-500/5"
                  : "border-foreground/10 bg-foreground/2"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold truncate">{group.listing_title}</h3>
                    {group.unread_count > 0 && (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white text-xs font-bold">
                        {group.unread_count}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground/70 mb-2">
                    with {group.other_user_name}
                  </p>
                  <p className="text-sm text-foreground/60 truncate">
                    {group.is_sender ? "You: " : ""}{group.last_message}
                  </p>
                </div>
                <div className="text-xs text-foreground/50 whitespace-nowrap">
                  {new Date(group.last_message_time).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Post Detail Modal with Messages tab */}
      {selectedListing && (
        <PostDetailModal
          postId={selectedListing.id}
          postType={selectedListing.type}
          defaultTab="messages"
          onClose={() => {
            setSelectedListing(null);
            setRefreshKey((prev) => prev + 1); // Refresh to update unread counts
          }}
        />
      )}
    </div>
  );
}
