// SmartBus Delhi E-Ticketing System
// Modeled on DTC Open Mobility ONDC e-ticketing standards

const fs = require("fs");
const path = require("path");

const TICKETS_FILE = path.join(__dirname, "../data/issued_tickets.json");

// In-memory ticket storage initialized from disk
let issuedTickets = [];

try {
  if (fs.existsSync(TICKETS_FILE)) {
    const raw = fs.readFileSync(TICKETS_FILE, "utf-8");
    issuedTickets = JSON.parse(raw);
  }
} catch (e) {
  issuedTickets = [];
}

function saveTickets() {
  try {
    fs.writeFileSync(TICKETS_FILE, JSON.stringify(issuedTickets, null, 2), "utf-8");
  } catch (e) {
    console.error("Could not persist tickets to disk:", e);
  }
}

function generateTicketCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "DTC-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Issue a new digital bus ticket
 */
function issueTicket({
  routeName = "Route DTC",
  routeId = "DTC",
  fromStop = "Boarding Stop",
  toStop = "Destination Stop",
  fare = 10,
  passengerCount = 1,
  ticketType = "NON_AC", // 'NON_AC', 'AC', 'PINK_PASS', 'DAILY_PASS'
  passengerName = "Passenger",
  isPinkPass = false,
  paymentMethod = "UPI",
  vehicleNumber = "DL1PD" + Math.floor(1000 + Math.random() * 9000)
}) {
  const now = new Date();
  const validUntil = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours validity

  const totalAmount = isPinkPass ? 0 : fare * passengerCount;
  const ticketId = generateTicketCode();

  const ticket = {
    ticketId,
    routeName,
    routeId,
    fromStop,
    toStop,
    passengerCount: parseInt(passengerCount) || 1,
    ticketType: isPinkPass ? "PINK_PASS_FREE" : ticketType,
    isPinkPass: Boolean(isPinkPass),
    unitFare: isPinkPass ? 0 : fare,
    totalAmount,
    currency: "INR",
    vehicleNumber,
    passengerName,
    paymentMethod: isPinkPass ? "Delhi Govt Pink Pass Subsidy" : paymentMethod,
    status: "ACTIVE",
    bookedAt: now.toISOString(),
    validUntil: validUntil.toISOString(),
    qrData: `DTC:${ticketId}:${routeName}:${fromStop}>>${toStop}:PAX${passengerCount}:INR${totalAmount}`
  };

  issuedTickets.unshift(ticket);
  saveTickets();

  return ticket;
}

/**
 * Get all issued tickets
 */
function getAllTickets() {
  return issuedTickets;
}

/**
 * Get ticket by ID
 */
function getTicketById(ticketId) {
  return issuedTickets.find(t => t.ticketId.toUpperCase() === ticketId.toUpperCase());
}

module.exports = {
  issueTicket,
  getAllTickets,
  getTicketById
};
