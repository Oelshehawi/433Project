"use client";

import React, { useEffect, useState } from "react";

interface UdpMessage {
  message: string;
  timestamp: number;
  id: string; // Unique identifier for each message
}

export default function UdpMessageDisplay() {
  const [messages, setMessages] = useState<UdpMessage[]>([]);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Function to handle UDP message events
    const handleUdpMessage = (event: CustomEvent) => {
      const { message, timestamp } = event.detail;

      // Add the new message to the state
      setMessages((prevMessages) => {
        // Keep only the last 5 messages to avoid cluttering the UI
        const newMessages = [
          ...prevMessages,
          {
            message,
            timestamp,
            id: crypto.randomUUID(),
          },
        ];

        if (newMessages.length > 5) {
          return newMessages.slice(newMessages.length - 5);
        }
        return newMessages;
      });
    };

    // Add event listener
    window.addEventListener("udp_message", handleUdpMessage as EventListener);

    // Clean up the event listener
    return () => {
      window.removeEventListener(
        "udp_message",
        handleUdpMessage as EventListener
      );
    };
  }, []);

  // Format timestamp
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, "0")}:${date
      .getMinutes()
      .toString()
      .padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed bottom-4 right-4 w-96 z-50">
      <div className="bg-gray-800 rounded-lg shadow-lg p-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-white font-semibold">UDP Messages</h3>
          <button
            onClick={() => setIsVisible(!isVisible)}
            className="text-gray-400 hover:text-white text-sm"
          >
            {isVisible ? "Hide" : "Show"}
          </button>
        </div>

        {isVisible && (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-gray-400 text-sm">No messages received yet</p>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="bg-gray-700 rounded p-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-300">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                  <p className="text-white mt-1 break-words">{msg.message}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
