import { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Sparkles, Navigation, Bot, User, ArrowRight, Ticket } from "lucide-react";

function Chatbot({ onSelectRoute, onTabChange, onOpenTickets }) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: "bot",
      text: "👋 Hi! I am your **SmartBus AI Assistant**.\n\nAsk me anything about Delhi transit, routes, bus arrivals, traffic congestion, or fares!",
      suggestions: [
        "From Connaught Place to AIIMS",
        "How is Ring Road traffic?",
        "When is the best time to travel?",
        "Electric bus fleet"
      ]
    }
  ]);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const sendMessage = async (textToSend) => {
    const q = textToSend || input;
    if (!q.trim() || loading) return;

    const userMsg = { sender: "user", text: q };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to get reply");
      }

      const botMsg = {
        sender: "bot",
        text: data.reply,
        suggestions: data.suggestions || [],
        action: data.action
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { sender: "bot", text: "⚠️ Sorry, I encountered an error: " + err.message }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (action) => {
    if (action.type === "DISPLAY_ROUTE" && onSelectRoute) {
      onSelectRoute(action);
      setIsOpen(false);
      if (onTabChange) onTabChange("planner");
    }
  };

  return (
    <>
      {/* FLOATING CHAT TRIGGER BUTTON */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            background: "linear-gradient(135deg, #059669, #0284c7)",
            color: "white",
            border: "none",
            borderRadius: "50px",
            padding: "12px 20px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
            cursor: "pointer",
            zIndex: 1000,
            fontWeight: "700",
            fontSize: "14px",
            transition: "transform 0.2s"
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1.0)")}
        >
          <Sparkles size={18} />
          Ask SmartBus AI
          <span style={{
            background: "#ffffff33",
            padding: "2px 8px",
            borderRadius: "20px",
            fontSize: "11px"
          }}>
            💬
          </span>
        </button>
      )}

      {/* CHAT WINDOW MODAL */}
      {isOpen && (
        <div style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          width: "380px",
          height: "540px",
          background: "#ffffff",
          borderRadius: "16px",
          boxShadow: "0 12px 36px rgba(15, 23, 42, 0.25)",
          display: "flex",
          flexDirection: "column",
          zIndex: 1001,
          overflow: "hidden",
          border: "1px solid #e2e8f0"
        }}>
          {/* HEADER */}
          <div style={{
            background: "linear-gradient(135deg, #102943, #15803d)",
            color: "white",
            padding: "16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: "#ffffff22",
                display: "grid",
                placeItems: "center"
              }}>
                <Bot size={18} />
              </div>
              <div>
                <strong style={{ fontSize: "14px", display: "block" }}>SmartBus AI Assistant</strong>
                <small style={{ color: "#a7f3d0", fontSize: "11px" }}>DTC Telemetry & Traffic AI</small>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "white",
                cursor: "pointer",
                padding: "4px"
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* MESSAGES CONTAINER */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            background: "#f8fafc"
          }}>
            {messages.map((m, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: m.sender === "user" ? "flex-end" : "flex-start"
                }}
              >
                <div style={{
                  maxWidth: "85%",
                  padding: "10px 14px",
                  borderRadius: m.sender === "user" ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                  background: m.sender === "user" ? "#047857" : "#ffffff",
                  color: m.sender === "user" ? "#ffffff" : "#1e293b",
                  fontSize: "12px",
                  lineHeight: "1.5",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
                  border: m.sender === "user" ? "none" : "1px solid #e2e8f0",
                  whiteSpace: "pre-line"
                }}>
                  {m.text}
                </div>

                {/* ACTION BUTTON (e.g. Plot on Map) */}
                {m.action && m.action.type === "DISPLAY_ROUTE" && (
                  <button
                    onClick={() => handleAction(m.action)}
                    style={{
                      marginTop: "6px",
                      background: "#2563eb",
                      color: "white",
                      border: "none",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: "700",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    <Navigation size={12} />
                    View Route on Map →
                  </button>
                )}

                {/* ACTION BUTTON: OPEN TICKET BOOKING */}
                {m.action && m.action.type === "OPEN_TICKET_MODAL" && (
                  <button
                    onClick={() => {
                      if (onOpenTickets) onOpenTickets();
                      setIsOpen(false);
                    }}
                    style={{
                      marginTop: "6px",
                      background: "linear-gradient(135deg, #059669, #047857)",
                      color: "white",
                      border: "none",
                      padding: "7px 14px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: "700",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                    }}
                  >
                    <Ticket size={13} />
                    Buy DTC Bus Ticket Online ➔
                  </button>
                )}

                {/* SUGGESTION CHIPS */}
                {m.suggestions && m.suggestions.length > 0 && idx === messages.length - 1 && (
                  <div style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "6px",
                    marginTop: "8px"
                  }}>
                    {m.suggestions.map((s, sIdx) => (
                      <button
                        key={sIdx}
                        onClick={() => sendMessage(s)}
                        style={{
                          background: "#ffffff",
                          border: "1px solid #cbd5e1",
                          color: "#334155",
                          padding: "4px 8px",
                          borderRadius: "12px",
                          fontSize: "10px",
                          cursor: "pointer",
                          fontWeight: "500"
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div style={{
                alignSelf: "flex-start",
                padding: "8px 12px",
                background: "#ffffff",
                borderRadius: "12px",
                fontSize: "11px",
                color: "#64748b",
                fontStyle: "italic"
              }}>
                SmartBus AI is thinking...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* INPUT FORM */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            style={{
              padding: "10px",
              background: "#ffffff",
              borderTop: "1px solid #e2e8f0",
              display: "flex",
              gap: "8px"
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about routes, traffic, buses..."
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "12px",
                outline: "none"
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{
                background: "#047857",
                color: "white",
                border: "none",
                borderRadius: "8px",
                padding: "8px 12px",
                cursor: "pointer",
                display: "grid",
                placeItems: "center"
              }}
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

export default Chatbot;
