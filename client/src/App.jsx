import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import {
  BusFront,
  LayoutDashboard,
  MapPin,
  Route,
  Activity,
  Users,
  Clock,
  Navigation,
  Compass,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Zap,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Sparkles,
  Calendar,
  Eye,
  MessageSquare,
  Ticket
} from "lucide-react";

import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Tooltip
} from "react-leaflet";

import "leaflet/dist/leaflet.css";
import JourneyMapOverlay from "./JourneyMapOverlay";
import Chatbot from "./Chatbot";
import TicketModal from "./TicketModal";
import MyTickets from "./MyTickets";
import "./App.css";

const PRESET_PLACES = [
  { name: "Connaught Place", coords: [28.6304, 77.2177] },
  { name: "AIIMS Delhi", coords: [28.5672, 77.2100] },
  { name: "Kashmere Gate ISBT", coords: [28.6675, 77.2285] },
  { name: "Nehru Place", coords: [28.5494, 77.2529] },
  { name: "Anand Vihar ISBT", coords: [28.6502, 77.3160] },
  { name: "Dhaula Kuan", coords: [28.5921, 77.1614] },
  { name: "Karol Bagh", coords: [28.6441, 77.1895] },
  { name: "India Gate", coords: [28.6129, 77.2295] }
];

function App() {
  const [activeTab, setActiveTab] = useState("planner"); // 'planner', 'tracking', 'corridors', 'benchmarks', 'chat'
  const [from, setFrom] = useState("Connaught Place");
  const [to, setTo] = useState("AIIMS Delhi");
  const [departureHour, setDepartureHour] = useState(new Date().getHours());
  
  const [fromCoords, setFromCoords] = useState([28.6304, 77.2177]);
  const [toCoords, setToCoords] = useState([28.5672, 77.2100]);
  
  const [loading, setLoading] = useState(false);
  const [planResult, setPlanResult] = useState(null);
  const [selectedOptionIdx, setSelectedOptionIdx] = useState(0);
  const [expandedLegs, setExpandedLegs] = useState({});

  // Bus Telemetry & Prediction State
  const [liveBuses, setLiveBuses] = useState([]);
  const [forecastMinutes, setForecastMinutes] = useState(0); // 0 = Live, 10, 20, 30
  const [displayBuses, setDisplayBuses] = useState([]);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastTimeStr, setForecastTimeStr] = useState("");

  const [corridors, setCorridors] = useState([]);
  const [benchmarks, setBenchmarks] = useState(null);
  const [benchLoading, setBenchLoading] = useState(false);

  // E-Ticketing State
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [ticketModalData, setTicketModalData] = useState(null);
  const [myTickets, setMyTickets] = useState([]);

  // Fetch issued tickets
  const fetchMyTickets = async () => {
    try {
      const res = await axios.get("http://localhost:5001/api/tickets");
      if (res.data.success) {
        setMyTickets(res.data.data || []);
      }
    } catch (e) {
      console.error("Could not fetch tickets:", e);
    }
  };

  useEffect(() => {
    fetchMyTickets();
  }, []);

  const handleTicketBooked = (newTicket) => {
    setMyTickets(prev => [newTicket, ...prev]);
  };

  const openTicketBooking = (option) => {
    setTicketModalData({
      routeName: option?.routeName || "DTC Bus Route",
      routeId: option?.routeId || "DTC",
      fromStop: from,
      toStop: to,
      fare: option?.fare || { nonAc: 10, ac: 15 },
      ticketType: "NON_AC"
    });
    setIsTicketModalOpen(true);
  };

  const openExistingTicket = (ticket) => {
    setTicketModalData({ ...ticket, isExisting: true });
    setIsTicketModalOpen(true);
  };

  // Connect to backend Socket.IO for live buses
  useEffect(() => {
    const socket = io("http://localhost:5001");

    socket.on("connect", () => {
      console.log("Connected to SmartBus backend!");
    });

    socket.on("busUpdate", (updatedBuses) => {
      setLiveBuses(updatedBuses);
      if (forecastMinutes === 0) {
        setDisplayBuses(updatedBuses);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [forecastMinutes]);

  // Handle Future Bus Prediction slider/toggle
  const handleForecastChange = (mins) => {
    setForecastMinutes(mins);
    if (mins === 0) {
      setDisplayBuses(liveBuses);
      setForecastTimeStr("");
      return;
    }

    setForecastLoading(true);
    fetch(`http://localhost:5001/api/buses/predicted?minutesAhead=${mins}`)
      .then(res => res.json())
      .then(d => {
        if (d.success && d.data) {
          setDisplayBuses(d.data);
          setForecastTimeStr(d.forecastTime);
        }
        setForecastLoading(false);
      })
      .catch(err => {
        console.error("Forecast error:", err);
        setForecastLoading(false);
      });
  };

  // Fetch initial corridors
  useEffect(() => {
    fetch("http://localhost:5001/api/traffic/corridors")
      .then(res => res.json())
      .then(d => {
        if (d.success && d.corridors) {
          setCorridors(d.corridors);
        }
      })
      .catch(err => console.error("Could not fetch corridors:", err));
  }, []);

  const loadBenchmarks = () => {
    setBenchLoading(true);
    fetch(`http://localhost:5001/api/benchmark/compare?hour=${departureHour}`)
      .then(res => res.json())
      .then(d => {
        setBenchmarks(d);
        setBenchLoading(false);
      })
      .catch(err => {
        console.error("Benchmark error:", err);
        setBenchLoading(false);
      });
  };

  const geocode = async (placeName) => {
    const preset = PRESET_PLACES.find(p => p.name.toLowerCase() === placeName.toLowerCase().trim());
    if (preset) return preset.coords;

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(placeName + ", Delhi, India")}&limit=1`
    );
    const data = await res.json();
    if (!data || data.length === 0) {
      throw new Error(`Location not found: "${placeName}"`);
    }
    return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  };

  const handlePlanJourney = async (e, customHour = null) => {
    if (e && e.preventDefault) e.preventDefault();
    const hourToUse = customHour !== null ? customHour : departureHour;
    if (customHour !== null) setDepartureHour(customHour);

    setLoading(true);
    setPlanResult(null);

    try {
      const orig = await geocode(from);
      const dest = await geocode(to);
      setFromCoords(orig);
      setToCoords(dest);

      const res = await fetch("http://localhost:5001/api/journey/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromLat: orig[0],
          fromLon: orig[1],
          fromName: from,
          toLat: dest[0],
          toLon: dest[1],
          toName: to,
          departureHour: hourToUse
        })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to find routes");
      }

      setPlanResult(data.data);
      setSelectedOptionIdx(0);
    } catch (err) {
      alert("Journey Planning: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRouteFromChat = (action) => {
    setFrom(action.from);
    setTo(action.to);
    setFromCoords(action.fromCoords);
    setToCoords(action.toCoords);
    setPlanResult({
      options: [action.option],
      departureAdvisor: null
    });
    setSelectedOptionIdx(0);
    setActiveTab("planner");
  };

  // Run initial plan once on load
  useEffect(() => {
    handlePlanJourney();
  }, []);

  const selectedOption = planResult?.options && planResult.options[selectedOptionIdx];
  const advisor = planResult?.departureAdvisor;

  const toggleLegDetails = (legIdx) => {
    setExpandedLegs(prev => ({ ...prev, [legIdx]: !prev[legIdx] }));
  };

  return (
    <div className="app">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="brand">
          <BusFront size={28} />
          <h2>SmartBus</h2>
        </div>

        <p className="side-label">WORKSPACE</p>

        <div 
          className={`side-link ${activeTab === "planner" ? "active" : ""}`}
          onClick={() => setActiveTab("planner")}
        >
          <Route size={18} /> Journey Planner
        </div>

        <div 
          className={`side-link ${activeTab === "tracking" ? "active" : ""}`}
          onClick={() => setActiveTab("tracking")}
        >
          <MapPin size={18} /> Live & Future Fleet ({displayBuses.length})
        </div>

        <div 
          className={`side-link ${activeTab === "corridors" ? "active" : ""}`}
          onClick={() => setActiveTab("corridors")}
        >
          <Activity size={18} /> Traffic Corridors
        </div>

        <div 
          className={`side-link ${activeTab === "benchmarks" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("benchmarks");
            if (!benchmarks) loadBenchmarks();
          }}
        >
          <TrendingUp size={18} /> Model vs Google Maps
        </div>

        <div 
          className={`side-link ${activeTab === "tickets" ? "active" : ""}`}
          onClick={() => setActiveTab("tickets")}
        >
          <Ticket size={18} /> My Tickets ({myTickets.length})
        </div>

        <div className="side-bottom">
          <div className="online-dot"></div>
          AI Transit Assistant Online
          <p>29.27M GPS Pings · 2.56M Tickets</p>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main">
        <header className="topbar">
          <div>
            <small>Delhi Smart Mobility / AI Predictive Traffic Simulation</small>
            <h1>
              {activeTab === "planner" && "AI Bus Traffic Simulation & Predictive Journey Planner"}
              {activeTab === "tracking" && "Live GPS & Future Fleet Trajectory Prediction"}
              {activeTab === "corridors" && "Corridor Congestion & Speeds"}
              {activeTab === "benchmarks" && "Ground-Truth Benchmarks vs Google Maps"}
              {activeTab === "tickets" && "DTC Digital E-Tickets & Passes"}
            </h1>
          </div>

          <div className="top-actions" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={() => openTicketBooking(selectedOption)}
              style={{
                background: "linear-gradient(135deg, #059669, #047857)",
                color: "#ffffff",
                border: "none",
                padding: "8px 16px",
                borderRadius: "8px",
                fontWeight: "700",
                fontSize: "12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 2px 4px rgba(5, 150, 105, 0.2)"
              }}
            >
              <Ticket size={14} /> Buy Ticket Online
            </button>

            <div className="live-badge" style={{ background: forecastMinutes > 0 ? "#4338ca" : "" }}>
              <span></span>
              {forecastMinutes === 0
                ? `LIVE GPS: ${liveBuses.length} Active DTC Buses`
                : `PREDICTION (+${forecastMinutes}m): Forecast at ${forecastTimeStr}`}
            </div>
          </div>
        </header>

        <section className="content">
          {/* STATS OVERVIEW */}
          <div className="stats">
            <div className="stat-card">
              <BusFront />
              <p>Active Buses Streamed</p>
              <h2>{liveBuses.length || 150}</h2>
              <small>Real-time tracked fleet</small>
            </div>

            <div className="stat-card">
              <Sparkles style={{ color: "#7c3aed" }} />
              <p>Predictive Forecasting</p>
              <h2>+10 to +30m</h2>
              <small>Simulates where buses will be</small>
            </div>

            <div className="stat-card">
              <Clock style={{ color: "#0891b2" }} />
              <p>Departure Advisor</p>
              <h2>Optimal Time</h2>
              <small>Advises when to travel</small>
            </div>

            <div className="stat-card">
              <Activity />
              <p>Observed Fleet Speed</p>
              <h2>11.1 km/h</h2>
              <small>29.27M GPS pings baseline</small>
            </div>
          </div>

          {/* TAB 1: JOURNEY PLANNER & PREDICTIVE MAP */}
          {activeTab === "planner" && (
            <div className="dashboard-grid">
              {/* LEFT: LEAFLET MAP WITH FUTURE SIMULATION CONTROLS */}
              <div className="map-card">
                <div className="card-heading" style={{ flexWrap: "wrap", gap: "10px" }}>
                  <div>
                    <h3 style={{ margin: 0 }}>Delhi Transit & Trajectory Map</h3>
                    <small style={{ color: "#64748b" }}>
                      {forecastMinutes === 0
                        ? "Currently showing live bus positions"
                        : `Simulating projected positions in +${forecastMinutes} mins (${forecastTimeStr})`}
                    </small>
                  </div>

                  {/* PREDICTION TIME SLIDER / BUTTONS */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#f1f5f9", padding: "4px", borderRadius: "8px" }}>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "#475569", padding: "0 4px" }}>
                      SIMULATE:
                    </span>
                    {[0, 10, 20, 30].map(mins => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => handleForecastChange(mins)}
                        style={{
                          fontSize: "11px",
                          padding: "4px 9px",
                          borderRadius: "6px",
                          border: "none",
                          cursor: "pointer",
                          fontWeight: "600",
                          background: forecastMinutes === mins ? "#1e293b" : "transparent",
                          color: forecastMinutes === mins ? "#ffffff" : "#475569"
                        }}
                      >
                        {mins === 0 ? "Live Now" : `+${mins}m`}
                      </button>
                    ))}
                  </div>
                </div>

                <MapContainer
                  center={[28.6139, 77.2090]}
                  zoom={12}
                  scrollWheelZoom={true}
                  className="map"
                  style={{ height: "460px" }}
                >
                  <TileLayer
                    attribution='&copy; OpenStreetMap contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {/* Render display buses (live or predicted future positions) */}
                  {displayBuses.slice(0, 100).map((bus) => {
                    const isPred = forecastMinutes > 0;
                    return (
                      <CircleMarker
                        key={bus.id}
                        center={bus.position || [bus.latitude, bus.longitude]}
                        radius={bus.is_electric ? 7 : (isPred ? 6 : 5)}
                        pathOptions={{
                          color: isPred ? "#7c3aed" : (bus.is_electric ? "#059669" : "#2563eb"),
                          weight: isPred ? 3 : 2,
                          fillColor: isPred ? "#a855f7" : (bus.is_electric ? "#10b981" : "#3b82f6"),
                          fillOpacity: 0.9
                        }}
                      >
                        <Popup>
                          <strong>{bus.vehicle_id}</strong> {bus.is_electric && "⚡ (Electric)"}<br />
                          <strong>Route:</strong> {bus.route}<br />
                          {isPred ? (
                            <>
                              <span style={{ color: "#7c3aed", fontWeight: "700" }}>
                                🔮 Forecast (+{forecastMinutes}m):
                              </span><br />
                              Speed: {bus.predictedSpeedKmH || bus.speed} km/h<br />
                              Distance Projected: {bus.distanceProjectedKm} km<br />
                              Projected Time: {forecastTimeStr}
                            </>
                          ) : (
                            <>
                              Speed: {bus.speed} km/h<br />
                              Status: Live Active Ping
                            </>
                          )}
                        </Popup>
                      </CircleMarker>
                    );
                  })}

                  {/* Route Polyline and Stops Overlay */}
                  <JourneyMapOverlay
                    selectedOption={selectedOption}
                    originPos={fromCoords}
                    destPos={toCoords}
                  />
                </MapContainer>

                <div className="map-legend">
                  <span>🔵 Live Standard Bus</span>
                  <span>🟢 Live Electric Bus</span>
                  <span>🟣 Predicted Future Position</span>
                  <span>🟩 Bus Route Polyline</span>
                  <span>┈┈ Walking Leg</span>
                  <span>⚪ Stop</span>
                </div>
              </div>

              {/* RIGHT: PLANNER & PREDICTIVE DEPARTURE ADVISOR */}
              <div className="right-panel">
                <div className="journey-card">
                  <h3>Predictive Journey Planner</h3>
                  <p>AI-calculated transit times across departure windows</p>

                  <form onSubmit={(e) => handlePlanJourney(e)}>
                    <label>FROM (START LOCATION)</label>
                    <input
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                      placeholder="e.g. Connaught Place, AIIMS, Rohini"
                      required
                    />

                    {/* Quick Presets */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", margin: "6px 0 10px" }}>
                      {PRESET_PLACES.slice(0, 4).map(p => (
                        <button
                          key={p.name}
                          type="button"
                          onClick={() => setFrom(p.name)}
                          style={{
                            fontSize: "11px",
                            padding: "4px 8px",
                            background: from === p.name ? "#087a4c" : "#e8edf4",
                            color: from === p.name ? "#fff" : "#334155",
                            borderRadius: "4px",
                            border: "none",
                            cursor: "pointer"
                          }}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>

                    <label>TO (DESTINATION)</label>
                    <input
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      placeholder="e.g. AIIMS Delhi, Nehru Place, Anand Vihar"
                      required
                    />

                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", margin: "6px 0 10px" }}>
                      {PRESET_PLACES.slice(4).map(p => (
                        <button
                          key={p.name}
                          type="button"
                          onClick={() => setTo(p.name)}
                          style={{
                            fontSize: "11px",
                            padding: "4px 8px",
                            background: to === p.name ? "#087a4c" : "#e8edf4",
                            color: to === p.name ? "#fff" : "#334155",
                            borderRadius: "4px",
                            border: "none",
                            cursor: "pointer"
                          }}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>

                    <label>DEPARTURE TIME & TRAFFIC PROFILE</label>
                    <select
                      value={departureHour}
                      onChange={(e) => {
                        const newH = parseInt(e.target.value);
                        setDepartureHour(newH);
                        handlePlanJourney(null, newH);
                      }}
                      style={{
                        padding: "10px",
                        borderRadius: "7px",
                        border: "1px solid #dfe6ef",
                        background: "#f9fbfd",
                        color: "#26354a",
                        fontWeight: "500",
                        marginBottom: "12px"
                      }}
                    >
                      <option value="9">09:00 AM – Morning Peak (Heavy Congestion 1.7x)</option>
                      <option value="11">11:00 AM – Late Morning (Moderate 1.3x)</option>
                      <option value="14">02:00 PM – Midday Off-Peak (Fluid 1.2x)</option>
                      <option value="18">06:00 PM – Evening Peak (Heavy Congestion 1.8x)</option>
                      <option value="22">10:00 PM – Late Night (Fluid 1.05x)</option>
                    </select>

                    <button type="submit" disabled={loading}>
                      {loading ? "Modeling Journey..." : "Predict Best Journey Options →"}
                    </button>
                  </form>

                  {/* AI DEPARTURE ADVISOR: WHEN SHOULD PASSENGERS TRAVEL? */}
                  {advisor && (
                    <div style={{
                      marginTop: "16px",
                      background: "#f8fafc",
                      border: "1px solid #cbd5e1",
                      borderRadius: "10px",
                      padding: "14px"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#1e293b", marginBottom: "6px" }}>
                        <Sparkles size={16} color="#7c3aed" />
                        <strong style={{ fontSize: "13px" }}>When Should You Travel?</strong>
                      </div>

                      <div style={{
                        background: advisor.timeSavedMinutes > 0 ? "#ecfdf5" : "#eff6ff",
                        border: advisor.timeSavedMinutes > 0 ? "1px solid #a7f3d0" : "1px solid #bfdbfe",
                        padding: "8px 12px",
                        borderRadius: "7px",
                        fontSize: "12px",
                        color: advisor.timeSavedMinutes > 0 ? "#065f46" : "#1e40af",
                        marginBottom: "10px"
                      }}>
                        💡 {advisor.recommendation}
                      </div>

                      {/* Timeline Slots */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {advisor.timeline.map((slot, sIdx) => {
                          const isCurrent = slot.hour === departureHour;
                          return (
                            <div
                              key={sIdx}
                              onClick={() => handlePlanJourney(null, slot.hour)}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "6px 10px",
                                borderRadius: "6px",
                                background: isCurrent ? "#e2e8f0" : (slot.isOptimal ? "#dcfce7" : "#ffffff"),
                                border: isCurrent ? "1px solid #94a3b8" : (slot.isOptimal ? "1px solid #86efac" : "1px solid #f1f5f9"),
                                cursor: "pointer",
                                fontSize: "11px",
                                transition: "all 0.15s"
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <Clock size={12} color="#64748b" />
                                <strong>{slot.label}</strong>
                                {slot.isOptimal && (
                                  <span style={{ background: "#15803d", color: "#fff", padding: "1px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: "700" }}>
                                    BEST TIME ⭐
                                  </span>
                                )}
                                {isCurrent && (
                                  <span style={{ color: "#475569", fontStyle: "italic", fontSize: "10px" }}>
                                    (Selected)
                                  </span>
                                )}
                              </div>

                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontWeight: "700", color: "#1e293b" }}>
                                  ~{slot.totalDurationMinutes} mins
                                </span>
                                {slot.savingsMinutes > 0 && (
                                  <span style={{ color: "#16a36a", fontWeight: "600" }}>
                                    Save {slot.savingsMinutes}m
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ROUTE RESULTS LIST */}
                  {planResult && planResult.options && planResult.options.length > 0 && (
                    <div style={{ marginTop: "16px" }}>
                      <h4 style={{ fontSize: "13px", marginBottom: "10px", color: "#334155" }}>
                        Plausible Journey Options at {departureHour}:00:
                      </h4>

                      {planResult.options.map((opt, idx) => (
                        <div
                          key={opt.id}
                          onClick={() => setSelectedOptionIdx(idx)}
                          style={{
                            border: selectedOptionIdx === idx ? "2px solid #159c69" : "1px solid #e2e8f0",
                            background: selectedOptionIdx === idx ? "#f0fdf4" : "#ffffff",
                            padding: "12px",
                            borderRadius: "9px",
                            marginBottom: "10px",
                            cursor: "pointer",
                            transition: "all 0.2s"
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{
                                background: opt.type === "DIRECT" ? "#047857" : "#1d4ed8",
                                color: "white",
                                padding: "3px 8px",
                                borderRadius: "5px",
                                fontSize: "11px",
                                fontWeight: "700"
                              }}>
                                {opt.type}
                              </span>
                              <strong style={{ fontSize: "14px" }}>{opt.routeName}</strong>
                            </div>

                            <span style={{ fontSize: "16px", fontWeight: "700", color: "#065f46" }}>
                              ~{opt.totalDurationMinutes} mins
                            </span>
                          </div>

                          <div style={{ display: "flex", gap: "10px", fontSize: "11px", color: "#64748b", marginTop: "8px" }}>
                            <span>📍 {opt.totalDistanceKm} km</span>
                            <span>⚡ {opt.trafficCondition.effectiveCommercialSpeedKmH} km/h avg</span>
                            <span>🎫 ₹{opt.fare.nonAc} (AC: ₹{opt.fare.ac})</span>
                            <span style={{
                              color: opt.trafficCondition.congestionLevel === "heavy" ? "#dc2626" : "#d97706",
                              fontWeight: "600"
                            }}>
                              ● {opt.trafficCondition.congestionLevel}
                            </span>
                          </div>

                          {/* Online Ticket Purchase Action */}
                          <div style={{ marginTop: "10px", display: "flex", gap: "8px" }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openTicketBooking(opt);
                              }}
                              style={{
                                flex: 1,
                                background: "#059669",
                                color: "white",
                                border: "none",
                                padding: "7px 12px",
                                borderRadius: "6px",
                                fontSize: "12px",
                                fontWeight: "700",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "6px"
                              }}
                            >
                              <Ticket size={13} /> Buy Bus Ticket (₹{opt.fare.nonAc})
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTicketModalData({
                                  routeName: opt.routeName,
                                  routeId: opt.routeId,
                                  fromStop: from,
                                  toStop: to,
                                  fare: opt.fare,
                                  ticketType: "PINK_PASS",
                                  isPinkPass: true
                                });
                                setIsTicketModalOpen(true);
                              }}
                              style={{
                                background: "#fff1f2",
                                color: "#be123c",
                                border: "1px solid #fda4af",
                                padding: "7px 10px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: "700",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px"
                              }}
                            >
                              🌸 Pink Pass (₹0)
                            </button>
                          </div>

                          {/* Itinerary details */}
                          {selectedOptionIdx === idx && (
                            <div style={{ marginTop: "12px", borderTop: "1px solid #cbd5e1", paddingTop: "10px" }}>
                              {opt.legs.map((leg, lIdx) => (
                                <div key={lIdx} style={{ fontSize: "12px", marginBottom: "8px", display: "flex", gap: "8px" }}>
                                  <span style={{ fontSize: "14px" }}>
                                    {leg.type === "WALK" ? "🚶‍♂️" : leg.type === "BUS" ? "🚌" : "🔄"}
                                  </span>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: "600", color: "#1e293b" }}>{leg.instruction}</div>
                                    <div style={{ color: "#64748b", fontSize: "11px" }}>
                                      {leg.type === "BUS" && (
                                        <>
                                          Ride: ~{leg.rideMinutes} mins ({leg.distanceKm} km, {leg.stopsCount} stops) · Wait: ~{leg.waitMinutes} mins
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleLegDetails(lIdx);
                                            }}
                                            style={{
                                              background: "none",
                                              border: "none",
                                              color: "#059669",
                                              cursor: "pointer",
                                              marginLeft: "8px",
                                              fontWeight: "600"
                                            }}
                                          >
                                            {expandedLegs[lIdx] ? "Hide stops ▲" : "View stops ▼"}
                                          </button>

                                          {expandedLegs[lIdx] && leg.intermediateStops && (
                                            <div style={{ marginTop: "6px", paddingLeft: "8px", borderLeft: "2px solid #a7f3d0" }}>
                                              {leg.intermediateStops.map((st, stIdx) => (
                                                <div key={stIdx} style={{ color: "#475569", fontSize: "11px", padding: "2px 0" }}>
                                                  {stIdx === 0 ? "🟢 " : stIdx === leg.intermediateStops.length - 1 ? "🔴 " : "⚪ "}
                                                  {st.name}
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </>
                                      )}
                                      {leg.type === "WALK" && `${leg.distanceKm} km · ~${leg.durationMinutes} mins`}
                                      {leg.type === "TRANSFER" && `Transfer buffer & connection wait: ~${leg.durationMinutes} mins`}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CORRIDOR CONGESTION DASHBOARD */}
          {activeTab === "corridors" && (
            <div>
              <div className="section-title">
                <div>
                  <h2>Delhi Key Corridors Traffic Intelligence</h2>
                  <p>Empirically derived from 200,000+ live DTC bus GPS traces</p>
                </div>
                <span>MEASURED FROM FLEET AVL</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
                {corridors.map((c, i) => (
                  <div key={i} className="stat-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <h3 style={{ fontSize: "15px", color: "#1e293b" }}>{c.corridor}</h3>
                      <span style={{
                        padding: "4px 8px",
                        borderRadius: "5px",
                        fontSize: "10px",
                        fontWeight: "700",
                        background: c.average_speed_kmh < 10 ? "#fee2e2" : "#fef3c7",
                        color: c.average_speed_kmh < 10 ? "#b91c1c" : "#b45309"
                      }}>
                        {c.congestion_status}
                      </span>
                    </div>

                    <div style={{ marginTop: "16px", display: "flex", alignItems: "baseline", gap: "8px" }}>
                      <span style={{ fontSize: "28px", fontWeight: "700", color: "#0f172a" }}>
                        {c.average_speed_kmh}
                      </span>
                      <span style={{ color: "#64748b", fontSize: "13px" }}>km/h avg speed</span>
                    </div>

                    <small style={{ color: "#94a3b8", display: "block", marginTop: "8px" }}>
                      Sample pings: {c.sample_pings?.toLocaleString() || "Thousands"}
                    </small>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: BENCHMARK SUITE VS GOOGLE MAPS */}
          {activeTab === "benchmarks" && (
            <div>
              <div className="section-title">
                <div>
                  <h2>Validation Against Google Maps Actual Travel Times</h2>
                  <p>Benchmark location pairs evaluated against verified Google Maps transit durations</p>
                </div>
                <button
                  onClick={loadBenchmarks}
                  disabled={benchLoading}
                  style={{
                    padding: "8px 14px",
                    background: "#087a4c",
                    color: "white",
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: "600"
                  }}
                >
                  {benchLoading ? "Running..." : "Re-run Evaluation 🔄"}
                </button>
              </div>

              {benchmarks && (
                <div className="table-card">
                  <table>
                    <thead>
                      <tr>
                        <th>LOCATION PAIR</th>
                        <th>RECOMMENDED ROUTE</th>
                        <th>OUR ESTIMATED TIME</th>
                        <th>GOOGLE MAPS ACTUAL</th>
                        <th>COMMERCIAL SPEED</th>
                        <th>EVALUATION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {benchmarks.results.map((r, i) => (
                        <tr key={i}>
                          <td>
                            <strong>{r.pairName}</strong><br />
                            <small style={{ color: "#64748b" }}>{r.from} ➔ {r.to}</small>
                          </td>
                          <td>
                            <span style={{
                              background: "#e0f2fe",
                              color: "#0369a1",
                              padding: "4px 8px",
                              borderRadius: "4px",
                              fontWeight: "600"
                            }}>
                              {r.ourModel.recommendedRoute}
                            </span>
                          </td>
                          <td>
                            <strong style={{ fontSize: "15px", color: "#047857" }}>
                              {r.ourModel.totalEstimatedMinutes} mins
                            </strong>
                            <small style={{ display: "block", color: "#64748b" }}>
                              {r.ourModel.totalDistanceKm} km
                            </small>
                          </td>
                          <td>
                            <strong>{r.googleMapsBenchmark.durationRangeMinutes[0]} – {r.googleMapsBenchmark.durationRangeMinutes[1]} mins</strong>
                            <small style={{ display: "block", color: "#64748b" }}>
                              ~{r.googleMapsBenchmark.typicalDistanceKm} km
                            </small>
                          </td>
                          <td>
                            {r.ourModel.commercialSpeedKmH} km/h
                          </td>
                          <td>
                            <span style={{
                              padding: "4px 8px",
                              borderRadius: "5px",
                              fontSize: "11px",
                              fontWeight: "700",
                              background: r.evaluation.status === "EXCELLENT_MATCH" ? "#dcfce7" : "#fef9c3",
                              color: r.evaluation.status === "EXCELLENT_MATCH" ? "#15803d" : "#a16207"
                            }}>
                              ✓ {r.evaluation.status.replace("_", " ")}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: LIVE & FUTURE FLEET MONITOR */}
          {activeTab === "tracking" && (
            <div>
              <div className="fleet-title">
                <h2>Real-time & Projected DTC Bus Fleet Telemetry</h2>
                <span>{displayBuses.length} VEHICLES</span>
              </div>

              <div style={{ marginBottom: "16px", display: "flex", gap: "8px" }}>
                {[0, 10, 20, 30].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => handleForecastChange(mins)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "7px",
                      border: "none",
                      cursor: "pointer",
                      fontWeight: "600",
                      background: forecastMinutes === mins ? "#087a4c" : "#e2e8f0",
                      color: forecastMinutes === mins ? "#ffffff" : "#334155"
                    }}
                  >
                    {mins === 0 ? "Live Telemetry" : `Forecast (+${mins} mins)`}
                  </button>
                ))}
              </div>

              <div className="table-card">
                <table>
                  <thead>
                    <tr>
                      <th>VEHICLE NUMBER</th>
                      <th>TYPE</th>
                      <th>ROUTE</th>
                      <th>SPEED (KM/H)</th>
                      <th>POSITION (LAT, LNG)</th>
                      <th>TELEMETRY STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayBuses.map((bus) => (
                      <tr key={bus.id}>
                        <td><strong>{bus.vehicle_id}</strong></td>
                        <td>
                          {bus.is_electric ? (
                            <span style={{ color: "#059669", fontWeight: "600" }}>⚡ Electric (EV)</span>
                          ) : (
                            <span style={{ color: "#475569" }}>CNG Standard</span>
                          )}
                        </td>
                        <td>{bus.route}</td>
                        <td>{bus.predictedSpeedKmH || bus.speed} km/h</td>
                        <td>
                          {bus.latitude?.toFixed(4)}, {bus.longitude?.toFixed(4)}
                        </td>
                        <td className="connected">
                          {forecastMinutes > 0 ? (
                            <span style={{ color: "#7c3aed", fontWeight: "700" }}>
                              🔮 Projected (+{forecastMinutes}m)
                            </span>
                          ) : (
                            "● Active GPS Ping"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: MY TICKETS & BUS PASSES */}
          {activeTab === "tickets" && (
            <MyTickets
              onSelectTicket={openExistingTicket}
              onBookNew={() => openTicketBooking(selectedOption)}
            />
          )}

          <footer>
            SmartBus Delhi © 2026 | Powered by DTC GTFS-RT AVL Feeds & ONDC E-Ticketing Data
            <span>AI Predictive Traffic Simulation & Departure Advisor</span>
          </footer>
        </section>
      </main>

      {/* FLOATING INTERACTIVE CHATBOT */}
      <Chatbot
        onSelectRoute={handleRouteFromChat}
        onTabChange={setActiveTab}
        onOpenTickets={() => openTicketBooking(selectedOption)}
      />

      {/* ONLINE TICKET BOOKING & DIGITAL PASS MODAL */}
      <TicketModal
        isOpen={isTicketModalOpen}
        onClose={() => setIsTicketModalOpen(false)}
        initialData={ticketModalData}
        onTicketBooked={handleTicketBooked}
      />
    </div>
  );
}

export default App;
