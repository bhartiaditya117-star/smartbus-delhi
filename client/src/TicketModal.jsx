import React, { useState, useEffect } from "react";
import {
  Ticket,
  CheckCircle2,
  Clock,
  QrCode,
  X,
  CreditCard,
  Smartphone,
  ShieldCheck,
  User,
  Users,
  Bus,
  Sparkles,
  Printer,
  Copy,
  ChevronRight,
  Heart
} from "lucide-react";
import axios from "axios";

/**
 * Renders an authentic-looking QR Code as SVG using deterministic bits
 * with standard 7x7 corner finder patterns and timing tracks
 */
function AuthenticQRCode({ value, size = 180, color = "#0f172a" }) {
  // 25x25 matrix
  const N = 25;
  const matrix = Array(N).fill(0).map(() => Array(N).fill(false));

  // Helper to draw 7x7 finder pattern
  const drawFinder = (r0, c0) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (
          r === 0 || r === 6 || c === 0 || c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          matrix[r0 + r][c0 + c] = true;
        } else {
          matrix[r0 + r][c0 + c] = false;
        }
      }
    }
  };

  // 3 Finder patterns
  drawFinder(0, 0); // Top-left
  drawFinder(0, N - 7); // Top-right
  drawFinder(N - 7, 0); // Bottom-left

  // Timing lines
  for (let i = 8; i < N - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Simple deterministic hash to fill the rest of the data cells
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      // Skip finder zones
      const inTL = r < 8 && c < 8;
      const inTR = r < 8 && c >= N - 8;
      const inBL = r >= N - 8 && c < 8;
      const inTiming = r === 6 || c === 6;
      if (inTL || inTR || inBL || inTiming) continue;

      // Seed pseudo-random bit using position and hash
      const bitVal = Math.sin(hash + r * 31 + c * 17) * 10000;
      matrix[r][c] = (bitVal - Math.floor(bitVal)) > 0.48;
    }
  }

  const cellSize = size / N;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ background: "#ffffff", borderRadius: "8px", padding: "6px" }}>
      {matrix.map((row, r) =>
        row.map((filled, c) =>
          filled ? (
            <rect
              key={`${r}-${c}`}
              x={c * cellSize}
              y={r * cellSize}
              width={cellSize + 0.3}
              height={cellSize + 0.3}
              fill={color}
            />
          ) : null
        )
      )}
    </svg>
  );
}

export default function TicketModal({ isOpen, onClose, initialData = null, onTicketBooked }) {
  if (!isOpen) return null;

  // Form State
  const [routeName, setRouteName] = useState(initialData?.routeName || "Route 502 Down");
  const [fromStop, setFromStop] = useState(initialData?.fromStop || "Connaught Place");
  const [toStop, setToStop] = useState(initialData?.toStop || "AIIMS Delhi");
  const [ticketType, setTicketType] = useState(initialData?.ticketType || "NON_AC");
  const [passengerCount, setPassengerCount] = useState(1);
  const [passengerName, setPassengerName] = useState("Delhi Commuter");
  const [mobileNumber, setMobileNumber] = useState("9876543210");
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [isPinkPass, setIsPinkPass] = useState(false);

  // Issued Ticket State
  const [issuedTicket, setIssuedTicket] = useState(initialData?.isExisting ? initialData : null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState("");
  const [copied, setCopied] = useState(false);

  // Dynamic fare based on bus type and distance estimate
  const baseNonAcFare = initialData?.fare?.nonAc || 10;
  const baseAcFare = initialData?.fare?.ac || 15;
  const selectedBaseFare = isPinkPass ? 0 : (ticketType === "AC" ? baseAcFare : (ticketType === "DAILY_PASS" ? 40 : baseNonAcFare));
  const totalPayable = selectedBaseFare * passengerCount;

  // Toggle Pink Pass
  const handlePinkPassToggle = () => {
    const nextVal = !isPinkPass;
    setIsPinkPass(nextVal);
    if (nextVal) {
      setPaymentMethod("Govt Subsidy");
    } else {
      setPaymentMethod("UPI");
    }
  };

  // Ticket validity countdown
  useEffect(() => {
    if (!issuedTicket?.validUntil) return;

    const timer = setInterval(() => {
      const diff = new Date(issuedTicket.validUntil).getTime() - Date.now();
      if (diff <= 0) {
        setTimeRemaining("EXPIRED");
        clearInterval(timer);
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeRemaining(`${hours}h ${mins}m ${secs}s`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [issuedTicket]);

  const handleBookTicket = async (e) => {
    e.preventDefault();
    setBookingLoading(true);

    try {
      const payload = {
        routeName,
        routeId: initialData?.routeId || "DTC",
        fromStop,
        toStop,
        fare: selectedBaseFare,
        passengerCount,
        ticketType: isPinkPass ? "PINK_PASS" : ticketType,
        isPinkPass,
        passengerName,
        paymentMethod: isPinkPass ? "Delhi Govt Pink Pass Subsidy" : paymentMethod,
        vehicleNumber: initialData?.vehicleNumber || "DL1PD" + Math.floor(1000 + Math.random() * 9000)
      };

      const res = await axios.post("/api/tickets/book", payload);
      if (res.data.success) {
        setIssuedTicket(res.data.data);
        if (onTicketBooked) {
          onTicketBooked(res.data.data);
        }
      }
    } catch (err) {
      alert("Error booking ticket: " + (err.response?.data?.error || err.message));
    } finally {
      setBookingLoading(false);
    }
  };

  const copyTicketCode = () => {
    if (issuedTicket?.ticketId) {
      navigator.clipboard.writeText(issuedTicket.ticketId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
        overflowY: "auto"
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#ffffff",
          width: "100%",
          maxWidth: issuedTicket ? "480px" : "540px",
          borderRadius: "16px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
          position: "relative",
          border: "1px solid #e2e8f0"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div
          style={{
            background: issuedTicket?.isPinkPass
              ? "linear-gradient(135deg, #e11d48, #be123c)"
              : issuedTicket
              ? "linear-gradient(135deg, #059669, #047857)"
              : "linear-gradient(135deg, #1e293b, #0f172a)",
            color: "#ffffff",
            padding: "18px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Ticket size={24} color="#34d399" />
            <div>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "700" }}>
                {issuedTicket ? "Official DTC E-Ticket Pass" : "Buy Bus Ticket Online"}
              </h3>
              <small style={{ color: "#94a3b8", fontSize: "11px" }}>
                {issuedTicket ? "Delhi Transport Corporation · Govt. of NCT of Delhi" : "Instant QR Bus Pass · ONDC Mobility"}
              </small>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "rgba(255, 255, 255, 0.15)",
              border: "none",
              color: "#ffffff",
              borderRadius: "50%",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer"
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* BODY CONTENT */}
        <div style={{ padding: "24px" }}>
          {!issuedTicket ? (
            /* STAGE 1: BOOKING FORM */
            <form onSubmit={handleBookTicket}>
              {/* Route Summary Banner */}
              <div
                style={{
                  background: "#f1f5f9",
                  borderRadius: "10px",
                  padding: "12px 16px",
                  marginBottom: "18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}
              >
                <div>
                  <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: "700" }}>
                    Selected Route
                  </span>
                  <div style={{ fontWeight: "700", color: "#0f172a", fontSize: "15px" }}>
                    {routeName}
                  </div>
                  <div style={{ fontSize: "12px", color: "#475569", marginTop: "2px" }}>
                    🟢 {fromStop} ➔ 🔴 {toStop}
                  </div>
                </div>
                <div style={{ background: "#e2e8f0", padding: "6px 10px", borderRadius: "8px", textAlign: "right" }}>
                  <span style={{ fontSize: "10px", color: "#64748b", display: "block" }}>BASE FARE</span>
                  <strong style={{ fontSize: "15px", color: "#0f172a" }}>₹{selectedBaseFare}</strong>
                </div>
              </div>

              {/* Pink Pass Scheme Banner */}
              <div
                onClick={handlePinkPassToggle}
                style={{
                  background: isPinkPass ? "#fff1f2" : "#fdf2f8",
                  border: isPinkPass ? "2px solid #f43f5e" : "1px dashed #f472b6",
                  borderRadius: "10px",
                  padding: "10px 14px",
                  marginBottom: "16px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  transition: "all 0.2s"
                }}
              >
                <div
                  style={{
                    background: isPinkPass ? "#f43f5e" : "#fbcfe8",
                    color: isPinkPass ? "#ffffff" : "#be185d",
                    borderRadius: "50%",
                    width: "36px",
                    height: "36px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0
                  }}
                >
                  <Heart size={18} fill={isPinkPass ? "#ffffff" : "none"} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <strong style={{ color: "#9f1239", fontSize: "13px" }}>
                      Delhi Govt Pink Pass (मुफ़्त यात्रा)
                    </strong>
                    {isPinkPass && (
                      <span style={{ background: "#e11d48", color: "#fff", padding: "1px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: "700" }}>
                        ACTIVE: ₹0 FARE
                      </span>
                    )}
                  </div>
                  <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#be123c" }}>
                    100% Free bus travel for all female passengers under Delhi Government scheme.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={isPinkPass}
                  onChange={handlePinkPassToggle}
                  style={{ width: "18px", height: "18px", accentColor: "#e11d48", cursor: "pointer" }}
                />
              </div>

              {/* Bus Service Type Selector */}
              {!isPinkPass && (
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#334155", marginBottom: "8px" }}>
                    SELECT BUS SERVICE TYPE
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={() => setTicketType("NON_AC")}
                      style={{
                        padding: "10px 8px",
                        borderRadius: "8px",
                        border: ticketType === "NON_AC" ? "2px solid #059669" : "1px solid #cbd5e1",
                        background: ticketType === "NON_AC" ? "#ecfdf5" : "#ffffff",
                        color: ticketType === "NON_AC" ? "#065f46" : "#334155",
                        fontWeight: "600",
                        fontSize: "12px",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "4px"
                      }}
                    >
                      <Bus size={18} />
                      <span>Non-AC Bus</span>
                      <strong style={{ color: "#059669" }}>₹{baseNonAcFare}</strong>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTicketType("AC")}
                      style={{
                        padding: "10px 8px",
                        borderRadius: "8px",
                        border: ticketType === "AC" ? "2px solid #2563eb" : "1px solid #cbd5e1",
                        background: ticketType === "AC" ? "#eff6ff" : "#ffffff",
                        color: ticketType === "AC" ? "#1e40af" : "#334155",
                        fontWeight: "600",
                        fontSize: "12px",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "4px"
                      }}
                    >
                      <Sparkles size={18} />
                      <span>AC Bus (Low Floor)</span>
                      <strong style={{ color: "#2563eb" }}>₹{baseAcFare}</strong>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTicketType("DAILY_PASS")}
                      style={{
                        padding: "10px 8px",
                        borderRadius: "8px",
                        border: ticketType === "DAILY_PASS" ? "2px solid #7c3aed" : "1px solid #cbd5e1",
                        background: ticketType === "DAILY_PASS" ? "#f5f3ff" : "#ffffff",
                        color: ticketType === "DAILY_PASS" ? "#5b21b6" : "#334155",
                        fontWeight: "600",
                        fontSize: "12px",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "4px"
                      }}
                    >
                      <Ticket size={18} />
                      <span>Daily All-Route Pass</span>
                      <strong style={{ color: "#7c3aed" }}>₹40</strong>
                    </button>
                  </div>
                </div>
              )}

              {/* Passenger Count & Details */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                    PASSENGERS
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={() => setPassengerCount(Math.max(1, passengerCount - 1))}
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        background: "#f8fafc",
                        cursor: "pointer",
                        fontWeight: "700",
                        fontSize: "16px"
                      }}
                    >
                      -
                    </button>
                    <span style={{ fontSize: "16px", fontWeight: "700", minWidth: "24px", textAlign: "center" }}>
                      {passengerCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPassengerCount(Math.min(6, passengerCount + 1))}
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        background: "#f8fafc",
                        cursor: "pointer",
                        fontWeight: "700",
                        fontSize: "16px"
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                    PASSENGER NAME
                  </label>
                  <input
                    type="text"
                    value={passengerName}
                    onChange={(e) => setPassengerName(e.target.value)}
                    placeholder="Full Name"
                    required
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "7px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px"
                    }}
                  />
                </div>
              </div>

              {/* Payment Method Selector */}
              {!isPinkPass && (
                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                    PAYMENT METHOD
                  </label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {["UPI", "Card", "NetBanking"].map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setPaymentMethod(mode)}
                        style={{
                          flex: 1,
                          padding: "8px",
                          borderRadius: "6px",
                          border: paymentMethod === mode ? "2px solid #0f172a" : "1px solid #e2e8f0",
                          background: paymentMethod === mode ? "#f8fafc" : "#ffffff",
                          fontWeight: paymentMethod === mode ? "700" : "500",
                          fontSize: "12px",
                          cursor: "pointer"
                        }}
                      >
                        {mode === "UPI" && "📱 UPI (GPay/Paytm)"}
                        {mode === "Card" && "💳 Debit / Credit"}
                        {mode === "NetBanking" && "🏛️ Net Banking"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Fare Total & Submit Button */}
              <div
                style={{
                  borderTop: "1px solid #e2e8f0",
                  paddingTop: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}
              >
                <div>
                  <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase" }}>Total Fare</span>
                  <div style={{ fontSize: "22px", fontWeight: "800", color: isPinkPass ? "#e11d48" : "#047857" }}>
                    {isPinkPass ? "₹0 (Free)" : `₹${totalPayable}`}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={bookingLoading}
                  style={{
                    background: isPinkPass
                      ? "linear-gradient(135deg, #e11d48, #be123c)"
                      : "linear-gradient(135deg, #059669, #047857)",
                    color: "#ffffff",
                    border: "none",
                    padding: "12px 24px",
                    borderRadius: "8px",
                    fontWeight: "700",
                    fontSize: "14px",
                    cursor: "pointer",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                  }}
                >
                  {bookingLoading ? (
                    "Generating Pass..."
                  ) : (
                    <>
                      <span>{isPinkPass ? "Issue Free Pink Pass" : `Pay ₹${totalPayable} & Book`}</span>
                      <ChevronRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* STAGE 2: ISSUED DTC OFFICIAL E-TICKET PASS */
            <div>
              <div
                id="dtc-printable-ticket"
                style={{
                  background: issuedTicket.isPinkPass ? "#fff1f2" : "#f0fdf4",
                  border: issuedTicket.isPinkPass ? "2px solid #fda4af" : "2px solid #86efac",
                  borderRadius: "14px",
                  padding: "18px",
                  position: "relative",
                  boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05)"
                }}
              >
                {/* Status & Validity Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <ShieldCheck size={18} color={issuedTicket.isPinkPass ? "#e11d48" : "#059669"} />
                    <span style={{
                      fontWeight: "800",
                      fontSize: "12px",
                      letterSpacing: "0.5px",
                      color: issuedTicket.isPinkPass ? "#be123c" : "#065f46"
                    }}>
                      {issuedTicket.isPinkPass ? "DELHI GOVT PINK PASS · ACTIVE" : "VALID DTC E-TICKET"}
                    </span>
                  </div>

                  <div style={{
                    background: issuedTicket.isPinkPass ? "#e11d48" : "#047857",
                    color: "#ffffff",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: "700",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }}>
                    <Clock size={12} />
                    <span>{timeRemaining || "Valid 2h"}</span>
                  </div>
                </div>

                {/* Ticket ID & Bus Details */}
                <div style={{
                  background: "#ffffff",
                  borderRadius: "10px",
                  padding: "12px",
                  border: "1px solid #e2e8f0",
                  marginBottom: "14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}>
                  <div>
                    <span style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase" }}>TICKET REFERENCE</span>
                    <div style={{ fontSize: "17px", fontWeight: "800", color: "#0f172a", letterSpacing: "1px" }}>
                      {issuedTicket.ticketId}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase" }}>ASSIGNED BUS</span>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: "#1e293b" }}>
                      🚌 {issuedTicket.vehicleNumber || "DL1PD8121"}
                    </div>
                  </div>
                </div>

                {/* Journey Stops */}
                <div style={{
                  background: "#ffffff",
                  borderRadius: "10px",
                  padding: "12px",
                  border: "1px solid #e2e8f0",
                  marginBottom: "14px"
                }}>
                  <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "600", marginBottom: "4px" }}>
                    {issuedTicket.routeName}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                    <div style={{ flex: 1, fontWeight: "700", color: "#0f172a" }}>
                      🟢 {issuedTicket.fromStop}
                    </div>
                    <span style={{ color: "#94a3b8" }}>➔</span>
                    <div style={{ flex: 1, fontWeight: "700", color: "#0f172a" }}>
                      🔴 {issuedTicket.toStop}
                    </div>
                  </div>
                </div>

                {/* Authentic QR Code Section */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "14px 0" }}>
                  <AuthenticQRCode
                    value={issuedTicket.qrData || `DTC:${issuedTicket.ticketId}:${issuedTicket.routeName}`}
                    size={160}
                    color={issuedTicket.isPinkPass ? "#881337" : "#064e3b"}
                  />
                  <small style={{ color: "#64748b", fontSize: "11px", marginTop: "8px", textAlign: "center" }}>
                    Scan QR code for conductor validation on board
                  </small>
                </div>

                {/* Passenger & Fare Summary */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px",
                  fontSize: "12px",
                  borderTop: "1px dashed #cbd5e1",
                  paddingTop: "10px"
                }}>
                  <div>
                    <span style={{ color: "#64748b" }}>Passenger:</span>{" "}
                    <strong>{issuedTicket.passengerName || "Passenger"}</strong> ({issuedTicket.passengerCount} Pax)
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ color: "#64748b" }}>Paid:</span>{" "}
                    <strong style={{ fontSize: "14px", color: issuedTicket.isPinkPass ? "#e11d48" : "#047857" }}>
                      {issuedTicket.isPinkPass ? "₹0.00 (Govt Subsidy)" : `₹${issuedTicket.totalAmount}.00`}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>Payment:</span>{" "}
                    <span>{issuedTicket.paymentMethod}</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ color: "#64748b" }}>Type:</span>{" "}
                    <span>{issuedTicket.ticketType}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
                <button
                  type="button"
                  onClick={copyTicketCode}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#334155",
                    fontWeight: "600",
                    fontSize: "12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px"
                  }}
                >
                  <Copy size={14} />
                  <span>{copied ? "Code Copied!" : "Copy Code"}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#334155",
                    fontWeight: "600",
                    fontSize: "12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px"
                  }}
                >
                  <Printer size={14} />
                  <span>Print Ticket</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIssuedTicket(null)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#0f172a",
                    color: "#ffffff",
                    fontWeight: "600",
                    fontSize: "12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px"
                  }}
                >
                  <span>Book Another</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
