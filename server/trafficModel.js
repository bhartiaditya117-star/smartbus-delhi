// Delhi SmartBus Traffic Speed Model
// Derived from DTC real-time GTFS-RT vehicle feeds and October 2026 ticketing data

const travelPatterns = require('../data/delhi_travel_patterns.json');

// Base physical transit parameters
const CONFIG = {
  walkingSpeedKmH: 4.5,            // Standard walking pace (~75 m/min)
  freeFlowSpeedKmH: 32.0,          // Maximum realistic transit cruise speed in Delhi
  minCongestedSpeedKmH: 10.5,      // Heavy traffic crawl speed
  baseDwellTimeSecPerStop: 42,     // Average passenger dwell time per stop
  interchangeDwellSec: 75,         // Dwell time at major transit terminals
  baseTransferWalkSec: 180,        // Transfer interchange walk buffer (3 mins)
  
  // Major Delhi transit hubs with higher dwell & transfer capacity
  majorHubs: [
    "kashmere gate", "anand vihar", "connaught place", "shivaji stadium",
    "aiims", "dhaula kuan", "nehru place", "sarai kale khan", "ito",
    "azadpur", "uttam nagar", "karol bagh", "badarpur"
  ]
};

// Hourly intensity curve from 2.56 million actual DTC bus rides
const hourlyIntensity = travelPatterns.hourly_traffic_intensity || {
  0: 0.01, 1: 0.01, 2: 0.01, 3: 0.01, 4: 0.02, 5: 0.08,
  6: 0.22, 7: 0.45, 8: 0.90, 9: 1.00, 10: 0.65, 11: 0.38,
  12: 0.28, 13: 0.24, 14: 0.22, 15: 0.26, 16: 0.35, 17: 0.52,
  18: 0.72, 19: 0.68, 20: 0.50, 21: 0.30, 22: 0.14, 23: 0.04
};

/**
 * Get congestion multiplier for given hour (0-23)
 */
function getHourCongestionFactor(hour) {
  const intensity = hourlyIntensity[hour] !== undefined ? hourlyIntensity[hour] : 0.4;
  // Intensity 0.0 -> factor 1.0 (free flow)
  // Intensity 1.0 -> factor 1.75 (peak gridlock)
  return 1.0 + (intensity * 0.75);
}

/**
 * Determine corridor congestion tag based on route or stop coordinates
 */
function getCorridorFactor(stops) {
  if (!stops || stops.length === 0) return 1.1;

  let hasCentral = false;
  let hasRingRoad = false;
  let hasTransYamuna = false;

  for (const s of stops) {
    const lat = s.lat;
    const lon = s.lon;
    const name = (s.name || '').toLowerCase();

    // Central Delhi (CP, Mandi House, India Gate, Secretariat)
    if (lat >= 28.60 && lat <= 28.65 && lon >= 77.19 && lon <= 77.24) {
      hasCentral = true;
    }
    // Trans-Yamuna (East Delhi)
    if (lon > 77.26) {
      hasTransYamuna = true;
    }
    // Ring Road arterial nodes
    if (name.includes('ring') || name.includes('aiims') || name.includes('ashram') || name.includes('dhaula')) {
      hasRingRoad = true;
    }
  }

  if (hasCentral && hasTransYamuna) return 1.35; // Crossing river + center
  if (hasCentral) return 1.28;
  if (hasRingRoad) return 1.22;
  if (hasTransYamuna) return 1.20;
  return 1.12; // Outer / arterial
}

/**
 * Estimate bus segment duration given distance, intermediate stops, and departure hour
 */
function estimateBusSegment({ distanceKm, stops, departureHour = 9, liveSpeed = null }) {
  const hourFactor = getHourCongestionFactor(departureHour);
  const corridorFactor = getCorridorFactor(stops);
  const totalCongestionFactor = hourFactor * corridorFactor;

  // Running speed (excluding stop dwell times)
  let effectiveCruiseSpeed = CONFIG.freeFlowSpeedKmH / (totalCongestionFactor * 0.85);
  effectiveCruiseSpeed = Math.max(CONFIG.minCongestedSpeedKmH, Math.min(CONFIG.freeFlowSpeedKmH, effectiveCruiseSpeed));

  // If real-time active bus speed is available on this corridor, incorporate it
  if (liveSpeed && liveSpeed > 0) {
    // 60% real-time speed, 40% historical model
    effectiveCruiseSpeed = (0.6 * liveSpeed) + (0.4 * effectiveCruiseSpeed);
  }

  // Pure moving time in minutes
  const drivingMinutes = (distanceKm / effectiveCruiseSpeed) * 60;

  // Calculate dwell time at intermediate stops
  let totalDwellSec = 0;
  const stopCount = Math.max(0, stops.length - 1);
  for (let i = 0; i < stops.length; i++) {
    const sName = (stops[i].name || '').toLowerCase();
    const isMajor = CONFIG.majorHubs.some(h => sName.includes(h));
    totalDwellSec += isMajor ? CONFIG.interchangeDwellSec : CONFIG.baseDwellTimeSecPerStop;
  }
  const dwellMinutes = totalDwellSec / 60;

  const totalTransitMinutes = Math.round((drivingMinutes + dwellMinutes) * 10) / 10;
  const netCommercialSpeed = Math.round((distanceKm / (totalTransitMinutes / 60)) * 10) / 10;

  let congestionLevel = "low";
  if (totalCongestionFactor > 1.45 || netCommercialSpeed < 16) {
    congestionLevel = "heavy";
  } else if (totalCongestionFactor > 1.20 || netCommercialSpeed < 23) {
    congestionLevel = "moderate";
  }

  return {
    distanceKm: Math.round(distanceKm * 100) / 100,
    stopCount,
    drivingMinutes: Math.round(drivingMinutes * 10) / 10,
    dwellMinutes: Math.round(dwellMinutes * 10) / 10,
    totalMinutes: Math.ceil(totalTransitMinutes),
    effectiveSpeedKmH: netCommercialSpeed,
    runningSpeedKmH: Math.round(effectiveCruiseSpeed * 10) / 10,
    congestionFactor: Math.round(totalCongestionFactor * 100) / 100,
    congestionLevel
  };
}

/**
 * Compute expected bus wait time based on time of day and route frequency
 */
function estimateWaitTime({ routeId, departureHour = 9, liveBusNear = false, liveEtaMinutes = null }) {
  if (liveBusNear && liveEtaMinutes !== null && liveEtaMinutes >= 0) {
    return Math.max(2, Math.round(liveEtaMinutes));
  }

  // Peak hours have higher frequency (~6-10 min headway -> average wait 4-6 mins)
  // Off-peak ~12-15 min headway -> average wait 6-9 mins
  // Late night ~25-30 min headway -> average wait 12-18 mins
  const intensity = hourlyIntensity[departureHour] !== undefined ? hourlyIntensity[departureHour] : 0.4;
  if (intensity > 0.6) {
    return Math.floor(Math.random() * 3) + 4; // 4 to 6 mins
  } else if (intensity > 0.2) {
    return Math.floor(Math.random() * 4) + 6; // 6 to 9 mins
  } else {
    return Math.floor(Math.random() * 6) + 12; // 12 to 17 mins
  }
}

/**
 * Calculate walking time in minutes
 */
function calculateWalkTime(distanceKm) {
  return Math.ceil((distanceKm / CONFIG.walkingSpeedKmH) * 60);
}

/**
 * Calculate Delhi DTC bus fare (in INR)
 * Non-AC: Up to 4km: ₹5, 4-10km: ₹10, >10km: ₹15
 * AC: Up to 4km: ₹10, 4-8km: ₹15, 8-12km: ₹20, >12km: ₹25
 */
function calculateFare(distanceKm, isAc = false) {
  if (!isAc) {
    if (distanceKm <= 4) return 5;
    if (distanceKm <= 10) return 10;
    return 15;
  } else {
    if (distanceKm <= 4) return 10;
    if (distanceKm <= 8) return 15;
    if (distanceKm <= 12) return 20;
    return 25;
  }
}

module.exports = {
  CONFIG,
  getHourCongestionFactor,
  getCorridorFactor,
  estimateBusSegment,
  estimateWaitTime,
  calculateWalkTime,
  calculateFare
};
