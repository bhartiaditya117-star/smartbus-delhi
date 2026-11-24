import React, { useState, useEffect } from "react";
import { Ticket, Clock, ShieldCheck, QrCode, Bus, ArrowRight, RefreshCw, CheckCircle2 } from "lucide-react";
import axios from "axios";

export default function MyTickets({ onSelectTicket, onBookNew }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await axios.get("http://localhost:5001/api/tickets");
      if (res.data.success) {
        setTickets(res.data.data || []);
      }
    } catch (err) {
      console.error("Could not fetch tickets:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  return (
    <div>
      <div className="section-title">
        <div>
          <h2>My Delhi Transit E-Tickets & Passes</h2>
          <p>Active and past digital tickets issued via ONDC Open Mobility DTC network</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={fetchTickets}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#334155",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "600"
            }}
          >
            <RefreshCw size={14} /> Refresh
          </button>

          <button
            onClick={onBookNew}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              borderRadius: "8px",
              border: "none",
              background: "#059669",
              color: "#ffffff",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "700"
            }}
          >
            <Ticket size={14} /> + Book New Ticket
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
          Loading your e-tickets...
        </div>
      ) : tickets.length === 0 ? (
        <div
          style={{
            background: "#ffffff",
            borderRadius: "12px",
            padding: "40px 20px",
            textAlign: "center",
            border: "1px solid #e2e8f0"
          }}
        >
          <Ticket size={48} color="#94a3b8" style={{ margin: "0 auto 12px" }} />
          <h3 style={{ color: "#1e293b", marginBottom: "6px" }}>No Tickets Issued Yet</h3>
          <p style={{ color: "#64748b", fontSize: "13px", maxWidth: "420px", margin: "0 auto 18px" }}>
            Book your first DTC bus ticket online with instant QR validation or claim a free Delhi Govt Pink Pass for women.
          </p>
          <button
            onClick={onBookNew}
            style={{
              background: "#059669",
              color: "#ffffff",
              border: "none",
              padding: "10px 20px",
              borderRadius: "8px",
              fontWeight: "700",
              cursor: "pointer"
            }}
          >
            Book Bus Ticket Now
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "16px" }}>
          {tickets.map((t) => {
            const isExpired = new Date(t.validUntil).getTime() < Date.now();
            return (
              <div
                key={t.ticketId}
                onClick={() => onSelectTicket(t)}
                style={{
                  background: t.isPinkPass ? "#fff1f2" : "#ffffff",
                  border: t.isPinkPass ? "2px solid #fda4af" : "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "16px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.03)"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                  <div>
                    <span style={{
                      fontSize: "11px",
                      fontWeight: "800",
                      color: t.isPinkPass ? "#e11d48" : "#059669",
                      background: t.isPinkPass ? "#ffe4e6" : "#ecfdf5",
                      padding: "2px 8px",
                      borderRadius: "4px"
                    }}>
                      {t.isPinkPass ? "🌸 DELHI GOVT PINK PASS" : `🎫 DTC ${t.ticketType || "STANDARD"}`}
                    </span>
                    <h3 style={{ fontSize: "16px", fontWeight: "800", color: "#0f172a", margin: "6px 0 0" }}>
                      {t.ticketId}
                    </h3>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <strong style={{ fontSize: "16px", color: t.isPinkPass ? "#e11d48" : "#047857" }}>
                      {t.isPinkPass ? "₹0.00" : `₹${t.totalAmount}.00`}
                    </strong>
                    <span style={{ display: "block", fontSize: "11px", color: isExpired ? "#ef4444" : "#059669", fontWeight: "600" }}>
                      ● {isExpired ? "Expired" : "Active & Valid"}
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: "13px", fontWeight: "600", color: "#1e293b", marginBottom: "8px" }}>
                  {t.routeName}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#475569", marginBottom: "12px" }}>
                  <span>🟢 {t.fromStop}</span>
                  <ArrowRight size={12} color="#94a3b8" />
                  <span>🔴 {t.toStop}</span>
                </div>

                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderTop: "1px solid #f1f5f9",
                  paddingTop: "10px",
                  fontSize: "11px",
                  color: "#64748b"
                }}>
                  <span>🚌 {t.vehicleNumber || "Assigned Bus"} · {t.passengerCount} Pax</span>
                  <span style={{ color: "#059669", fontWeight: "700", display: "flex", alignItems: "center", gap: "4px" }}>
                    <QrCode size={13} /> View QR Code ➔
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
