// SmartBus Delhi AI Transit Chatbot Engine
// Handles natural language transit queries, route questions, traffic checks, and fleet lookup

const journeyPlanner = require("./journeyPlanner");
const trafficModel = require("./trafficModel");

const PRESET_PLACES = {
  "cp": { name: "Connaught Place", coords: [28.6304, 77.2177] },
  "connaught place": { name: "Connaught Place", coords: [28.6304, 77.2177] },
  "aiims": { name: "AIIMS Delhi", coords: [28.5672, 77.2100] },
  "aiims delhi": { name: "AIIMS Delhi", coords: [28.5672, 77.2100] },
  "kashmere gate": { name: "Kashmere Gate ISBT", coords: [28.6675, 77.2285] },
  "isbt": { name: "Kashmere Gate ISBT", coords: [28.6675, 77.2285] },
  "nehru place": { name: "Nehru Place", coords: [28.5494, 77.2529] },
  "anand vihar": { name: "Anand Vihar ISBT", coords: [28.6502, 77.3160] },
  "dhaula kuan": { name: "Dhaula Kuan", coords: [28.5921, 77.1614] },
  "karol bagh": { name: "Karol Bagh", coords: [28.6441, 77.1895] },
  "india gate": { name: "India Gate", coords: [28.6129, 77.2295] },
  "lajpat nagar": { name: "Lajpat Nagar Central Market", coords: [28.5700, 77.2400] },
  "rohini": { name: "Rohini Sector 14", coords: [28.7180, 77.1260] },
  "saket": { name: "Saket Metro", coords: [28.5204, 77.2014] },
  "ito": { name: "ITO Delhi", coords: [28.6300, 77.2430] }
};

function extractLocations(text) {
  const lower = text.toLowerCase();
  
  // Check patterns like "from X to Y", "X to Y", "go to Y from X"
  const fromToRegex = /(?:from\s+)?([a-z\s]+?)\s+(?:to|towards)\s+([a-z\s]+)/i;
  const match = lower.match(fromToRegex);

  let fromCandidate = null;
  let toCandidate = null;

  if (match) {
    const rawFrom = match[1].replace(/^(how to go|bus|route|navigate|take me)\s+/i, "").trim();
    const rawTo = match[2].replace(/\s+(please|now|fast|today|\?)/g, "").trim();

    fromCandidate = resolveLocation(rawFrom);
    toCandidate = resolveLocation(rawTo);
  }

  // Fallback: check all known preset place names in string
  if (!fromCandidate || !toCandidate) {
    const found = [];
    for (const key in PRESET_PLACES) {
      if (lower.includes(key)) {
        found.push(PRESET_PLACES[key]);
      }
    }
    if (found.length >= 2) {
      fromCandidate = found[0];
      toCandidate = found[1];
    }
  }

  return { from: fromCandidate, to: toCandidate };
}

function resolveLocation(name) {
  const clean = name.toLowerCase().trim();
  for (const key in PRESET_PLACES) {
    if (clean === key || clean.includes(key)) {
      return PRESET_PLACES[key];
    }
  }
  return null;
}

function processQuery({ message, activeBuses = [], corridors = [] }) {
  const text = (message || "").trim();
  const lower = text.toLowerCase();

  // 1. GREETING
  if (/^(hi|hello|hey|namaste|greetings)/i.test(lower) && lower.split(" ").length <= 3) {
    return {
      reply: "Hello! I am your SmartBus AI Delhi Transit Assistant. 🚌\n\nYou can ask me:\n• Route directions: *'How do I go from Connaught Place to AIIMS?'*\n• Traffic updates: *'What is the traffic like on Ring Road?'*\n• Fleet tracking: *'Show me active electric buses'*\n• Timing advice: *'When is the best time to leave to avoid traffic?'*\n• Fares & information: *'What are the bus fares in Delhi?'*",
      suggestions: [
        "From Connaught Place to AIIMS",
        "Kashmere Gate to Nehru Place",
        "How is Ring Road traffic?",
        "When is the best time to travel?"
      ]
    };
  }

  // 2. ONLINE BUS TICKET BOOKING & FARE INFORMATION
  if (lower.includes("buy ticket") || lower.includes("book ticket") || lower.includes("online ticket") || lower.includes("buy bus ticket") || lower.includes("purchase ticket") || lower.includes("pink pass")) {
    return {
      reply: "🎫 **Buy Bus Ticket Online / Delhi Govt Pink Pass**:\n\nYou can book instant digital e-tickets for all DTC buses directly on SmartBus!\n\n• **Standard Non-AC**: ₹5 / ₹10 / ₹15 based on distance\n• **AC Low-Floor (EV)**: ₹10 / ₹15 / ₹20 / ₹25\n• 🌸 **Delhi Govt Pink Pass**: **100% Free** bus travel for women!\n• **Daily All-Route Pass**: ₹40 (Non-AC) / ₹50 (AC)\n\nEvery online ticket includes an authentic **scannable QR pass** with 2-hour conductor validity and vehicle tracking.",
      action: {
        type: "OPEN_TICKET_MODAL"
      },
      suggestions: ["Buy ticket from CP to AIIMS", "Get free Pink Pass", "How is Ring Road traffic?"]
    };
  }

  if (lower.includes("fare") || lower.includes("ticket") || lower.includes("cost") || lower.includes("price") || lower.includes("free")) {
    return {
      reply: "🎫 **Delhi DTC Bus Fare Structure**:\n\n• **Non-AC Buses (Green / Red / Blue)**:\n  - Up to 4 km: ₹5\n  - 4 to 10 km: ₹10\n  - Beyond 10 km: ₹15\n\n• **AC Buses (Electric EV / Low Floor)**:\n  - Up to 4 km: ₹10\n  - 4 to 8 km: ₹15\n  - 8 to 12 km: ₹20\n  - Beyond 12 km: ₹25\n\n🎀 **Special Policy**: Women travel **100% free** on all Delhi government DTC and Cluster buses using the Pink Pass scheme!\n\n💡 *You can buy tickets online directly by clicking 'Buy Bus Ticket Online' or asking me to book!*",
      action: {
        type: "OPEN_TICKET_MODAL"
      },
      suggestions: ["Buy bus ticket online", "Claim free Pink Pass", "From CP to AIIMS"]
    };
  }

  // 3. ELECTRIC FLEET / SPECIFIC VEHICLE LOOKUP
  if (lower.includes("electric") || lower.includes("ev bus") || lower.includes("dl51ev") || lower.includes("fleet")) {
    const evBuses = activeBuses.filter(b => b.is_electric);
    const sample = evBuses.slice(0, 5);
    const sampleList = sample.map(b => `• **${b.vehicle_id}** on **${b.route}** (${b.speed} km/h)`).join("\n");

    return {
      reply: `⚡ **Delhi Electric Bus Fleet (Zero Emission)**:\n\nThere are **${evBuses.length} active electric buses** tracked in real time across the city right now.\n\nSample active EV buses:\n${sampleList}\n\nElectric buses operate on key arterial corridors with high acceleration and low noise. All women travel free via Pink tickets.`,
      suggestions: ["Show all active buses", "Connaught Place to AIIMS", "Check traffic corridors"]
    };
  }

  // 4. CORRIDOR CONGESTION & TRAFFIC SPEED
  if (lower.includes("traffic") || lower.includes("speed") || lower.includes("congest") || lower.includes("ring road") || lower.includes("jam")) {
    let matchedCorridor = null;
    for (const c of corridors) {
      const cWords = c.corridor.toLowerCase().split(/[\s(/)]+/);
      if (cWords.some(w => w.length > 3 && lower.includes(w))) {
        matchedCorridor = c;
        break;
      }
    }

    if (matchedCorridor) {
      return {
        reply: `🚦 **Live Traffic on ${matchedCorridor.corridor}**:\n\n• **Average Transit Speed**: ${matchedCorridor.average_speed_kmh} km/h\n• **Congestion Level**: **${matchedCorridor.congestion_status}**\n• **Sampled GPS pings**: ${matchedCorridor.sample_pings?.toLocaleString() || "Thousands"} vehicle observations\n\n*Tip: During peak hours (8:30-10:30 AM & 5:30-8:30 PM), bus speeds drop by 35-45% on this corridor.*`,
        suggestions: ["Check other corridors", "When to travel to avoid traffic?", "Plan a journey"]
      };
    } else {
      const summaryList = corridors.slice(0, 4).map(c => `• **${c.corridor.split("(")[0].trim()}**: ${c.average_speed_kmh} km/h (${c.congestion_status})`).join("\n");
      return {
        reply: `🚦 **Delhi Road Corridors Traffic Summary** (from live GPS fleet):\n\n${summaryList}\n\nCentral Delhi and South Ring Road currently experience the highest transit congestion.`,
        suggestions: ["How is Ring Road traffic?", "Best time to leave?", "CP to AIIMS route"]
      };
    }
  }

  // 5. TIMING ADVICE / "WHEN SHOULD I TRAVEL?"
  if (lower.includes("when") || lower.includes("best time") || lower.includes("avoid peak") || lower.includes("rush hour")) {
    return {
      reply: `⏰ **Delhi Bus Peak Hours & Travel Recommendations**:\n\n• 🔴 **Morning Peak (08:00 AM – 10:30 AM)**: Heaviest congestion. Transit speeds average **9.5 – 11 km/h**. Travel times are up to **1.7x longer**.\n• 🟢 **Midday Off-Peak (11:30 AM – 04:30 PM)**: Fluid traffic. Speeds average **18 – 24 km/h**. **Best time to travel** for up to 30% time savings!\n• 🔴 **Evening Peak (05:30 PM – 08:30 PM)**: Second congestion surge, particularly around Trans-Yamuna bridges and Ring Road.\n• 🟢 **Night Flow (after 09:00 PM)**: Fastest transit speeds (**28 – 35 km/h**).\n\n💡 *Use our Departure Advisor in the Journey Planner to see exact minute-by-minute time savings for your specific route!*`,
      suggestions: ["Plan CP to AIIMS", "Check Ring Road speed", "Fares in Delhi"]
    };
  }

  // 6. JOURNEY ROUTING INTENT ("from X to Y", "how to go to Y")
  const { from, to } = extractLocations(lower);

  if (from && to) {
    const curHour = new Date().getHours();
    const plan = journeyPlanner.planJourney({
      fromLat: from.coords[0],
      fromLon: from.coords[1],
      fromName: from.name,
      toLat: to.coords[0],
      toLon: to.coords[1],
      toName: to.name,
      departureHour: curHour,
      liveBuses: activeBuses
    });

    if (plan.options && plan.options.length > 0) {
      const top = plan.options[0];
      const advisor = plan.departureAdvisor;

      let replyText = `🎯 **Route Found**: **${top.routeName}** from **${from.name}** to **${to.name}**\n\n`;
      replyText += `• **Estimated Travel Time**: ~**${top.totalDurationMinutes} minutes** (${top.totalDistanceKm} km)\n`;
      replyText += `• **Route Type**: ${top.type === "DIRECT" ? "Direct Bus" : "1-Transfer Connection"}\n`;
      replyText += `• **Traffic Condition**: ${top.trafficCondition.congestionLevel.toUpperCase()} (Average Speed: ${top.trafficCondition.effectiveCommercialSpeedKmH} km/h)\n`;
      replyText += `• **Fare**: ₹${top.fare.nonAc} (Non-AC) / ₹${top.fare.ac} (AC) · *Free for women*\n\n`;

      if (top.legs && top.legs.length > 0) {
        replyText += `📍 **Itinerary**:\n`;
        top.legs.forEach(l => {
          const icon = l.type === "WALK" ? "🚶‍♂️" : (l.type === "BUS" ? "🚌" : "🔄");
          replyText += `${icon} ${l.instruction} (~${l.durationMinutes || l.rideMinutes} mins)\n`;
        });
      }

      if (advisor && advisor.timeSavedMinutes > 3) {
        replyText += `\n💡 **AI Timing Tip**: ${advisor.recommendation}`;
      }

      return {
        reply: replyText,
        action: {
          type: "DISPLAY_ROUTE",
          from: from.name,
          to: to.name,
          fromCoords: from.coords,
          toCoords: to.coords,
          option: top
        },
        suggestions: [
          "Show alternative route",
          "What is the best time to leave?",
          "Check corridor traffic"
        ]
      };
    }
  }

  // 7. DEFAULT HELPFUL FALLBACK
  return {
    reply: `I can help you plan your bus journey, check real-time traffic speeds, track live DTC buses, or advise on the best departure time across Delhi.\n\nTry asking:\n• *"From Connaught Place to AIIMS"*\n• *"Route from Kashmere Gate to Nehru Place"*\n• *"How fast are buses moving on Ring Road?"*\n• *"Show electric buses"*`,
    suggestions: [
      "Connaught Place to AIIMS",
      "Kashmere Gate to Nehru Place",
      "How is Ring Road traffic?",
      "Electric bus fleet"
    ]
  };
}

module.exports = {
  processQuery,
  extractLocations,
  PRESET_PLACES
};
