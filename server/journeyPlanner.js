// SmartBus Delhi Transit Journey Planner
// Multi-modal transit routing engine with dynamic traffic modeling & 1-transfer routing

const transitNetwork = require('../data/delhi_transit_network.json');
const trafficModel = require('./trafficModel');

const { stops, routes, stop_routes } = transitNetwork;

// Helper: Haversine distance in km
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371.0;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Find stops within maxDistKm of given lat/lon
 */
function findNearbyStops(lat, lon, maxDistKm = 1.4) {
  const nearby = [];
  for (const sid in stops) {
    const s = stops[sid];
    const dist = haversineKm(lat, lon, s.lat, s.lon);
    if (dist <= maxDistKm) {
      nearby.push({
        ...s,
        distanceKm: Math.round(dist * 100) / 100
      });
    }
  }
  nearby.sort((a, b) => a.distanceKm - b.distanceKm);
  return nearby.slice(0, 15);
}

/**
 * Generate AI departure time advisor ("When should passengers travel?")
 */
function getDepartureAdvisor({ fromLat, fromLon, fromName, toLat, toLon, toName, baseHour = 9, liveBuses = [] }) {
  // Test 5 slots: baseHour - 1, baseHour, baseHour + 1, baseHour + 2, baseHour + 3 (wrapped to 0-23)
  const hoursToTest = [
    (baseHour - 1 + 24) % 24,
    baseHour,
    (baseHour + 1) % 24,
    (baseHour + 2) % 24,
    (baseHour + 3) % 24
  ];

  const slots = [];
  let minDuration = Infinity;
  let bestSlot = null;
  let currentSlot = null;

  for (const h of hoursToTest) {
    const plan = planJourneyCore({
      fromLat, fromLon, fromName, toLat, toLon, toName,
      departureHour: h, liveBuses
    });

    if (plan.options && plan.options.length > 0) {
      const topOpt = plan.options[0];
      const dur = topOpt.totalDurationMinutes;
      const hourLabel = `${h % 12 === 0 ? 12 : h % 12}:00 ${h >= 12 ? 'PM' : 'AM'}`;
      const slot = {
        hour: h,
        label: hourLabel,
        totalDurationMinutes: dur,
        congestionLevel: topOpt.trafficCondition.congestionLevel,
        effectiveSpeedKmH: topOpt.trafficCondition.effectiveCommercialSpeedKmH,
        routeName: topOpt.routeName
      };

      slots.push(slot);
      if (h === baseHour) {
        currentSlot = slot;
      }
      if (dur < minDuration) {
        minDuration = dur;
        bestSlot = slot;
      }
    }
  }

  // Calculate savings
  const refDuration = currentSlot ? currentSlot.totalDurationMinutes : (slots[0]?.totalDurationMinutes || 45);
  slots.forEach(s => {
    s.savingsMinutes = Math.max(0, refDuration - s.totalDurationMinutes);
    s.isOptimal = bestSlot && s.hour === bestSlot.hour;
  });

  const timeSaved = bestSlot ? Math.max(0, refDuration - bestSlot.totalDurationMinutes) : 0;
  let recommendation = `Traveling at ${currentSlot?.label || 'selected time'} is optimal.`;
  if (bestSlot && timeSaved >= 5 && bestSlot.hour !== baseHour) {
    recommendation = `Departing at ${bestSlot.label} saves ~${timeSaved} minutes (${Math.round((timeSaved / refDuration) * 100)}% faster) by avoiding peak gridlock.`;
  } else if (currentSlot && currentSlot.congestionLevel === 'heavy') {
    recommendation = `Currently peak traffic. If flexible, off-peak departures (midday or after 8 PM) are up to 25-35% faster.`;
  }

  return {
    referenceDeparture: currentSlot?.label || `${baseHour}:00`,
    optimalDeparture: bestSlot?.label || `${baseHour}:00`,
    timeSavedMinutes: timeSaved,
    recommendation,
    timeline: slots
  };
}

/**
 * Core routing search
 */
function planJourneyCore({ fromLat, fromLon, fromName, toLat, toLon, toName, departureHour = 9, liveBuses = [] }) {
  const originStops = findNearbyStops(fromLat, fromLon, 1.4);
  const destStops = findNearbyStops(toLat, toLon, 1.4);

  if (originStops.length === 0 || destStops.length === 0) {
    return { options: [] };
  }

  const directOptions = [];
  const originStopIds = new Set(originStops.map(s => s.id));
  const destStopIds = new Set(destStops.map(s => s.id));

  const origDistMap = {};
  originStops.forEach(s => { origDistMap[s.id] = s.distanceKm; });
  const destDistMap = {};
  destStops.forEach(s => { destDistMap[s.id] = s.distanceKm; });

  const candidateRoutes = new Set();
  for (const s of originStops) {
    const rids = stop_routes[s.id] || [];
    for (const rid of rids) candidateRoutes.add(rid);
  }

  for (const rid of candidateRoutes) {
    const r = routes[rid];
    if (!r || !r.stops) continue;

    const rStops = r.stops;
    let firstOrigIdx = -1;
    let lastDestIdx = -1;

    for (let i = 0; i < rStops.length; i++) {
      const sid = rStops[i];
      if (firstOrigIdx === -1 && originStopIds.has(sid)) firstOrigIdx = i;
      if (firstOrigIdx !== -1 && i > firstOrigIdx && destStopIds.has(sid)) lastDestIdx = i;
    }

    if (firstOrigIdx !== -1 && lastDestIdx !== -1 && lastDestIdx > firstOrigIdx) {
      const boardStop = stops[rStops[firstOrigIdx]];
      const alightStop = stops[rStops[lastDestIdx]];
      const subStopIds = rStops.slice(firstOrigIdx, lastDestIdx + 1);
      const intermediateStops = subStopIds.map(sid => stops[sid]);

      let busDistKm = 0;
      for (let k = 1; k < intermediateStops.length; k++) {
        busDistKm += haversineKm(
          intermediateStops[k - 1].lat, intermediateStops[k - 1].lon,
          intermediateStops[k].lat, intermediateStops[k].lon
        );
      }

      const walkToBoardDist = origDistMap[boardStop.id] || 0.2;
      const walkFromAlightDist = destDistMap[alightStop.id] || 0.2;

      const walkToBoardMins = trafficModel.calculateWalkTime(walkToBoardDist);
      const walkFromAlightMins = trafficModel.calculateWalkTime(walkFromAlightDist);

      const activeBusesOnRoute = liveBuses.filter(b => b.route === r.name || b.routeId === rid);
      const hasLiveBus = activeBusesOnRoute.length > 0;
      const avgLiveSpeed = hasLiveBus ? (activeBusesOnRoute.reduce((acc, b) => acc + (b.speed || 20), 0) / activeBusesOnRoute.length) : null;

      const waitMins = trafficModel.estimateWaitTime({
        routeId: rid,
        departureHour,
        liveBusNear: hasLiveBus
      });

      const trafficEstimate = trafficModel.estimateBusSegment({
        distanceKm: busDistKm,
        stops: intermediateStops,
        departureHour,
        liveSpeed: avgLiveSpeed
      });

      const totalDurationMins = walkToBoardMins + waitMins + trafficEstimate.totalMinutes + walkFromAlightMins;
      const polyline = intermediateStops.map(s => [s.lat, s.lon]);

      directOptions.push({
        id: `direct-${rid}-${firstOrigIdx}-${lastDestIdx}`,
        type: "DIRECT",
        routeName: r.name,
        routeId: rid,
        totalDurationMinutes: totalDurationMins,
        totalDistanceKm: Math.round((walkToBoardDist + busDistKm + walkFromAlightDist) * 10) / 10,
        fare: {
          nonAc: trafficModel.calculateFare(busDistKm, false),
          ac: trafficModel.calculateFare(busDistKm, true)
        },
        trafficCondition: {
          congestionLevel: trafficEstimate.congestionLevel,
          congestionFactor: trafficEstimate.congestionFactor,
          effectiveCommercialSpeedKmH: trafficEstimate.effectiveSpeedKmH,
          runningSpeedKmH: trafficEstimate.runningSpeedKmH
        },
        legs: [
          {
            type: "WALK",
            instruction: `Walk to ${boardStop.name}`,
            distanceKm: walkToBoardDist,
            durationMinutes: walkToBoardMins,
            from: { name: fromName || "Starting Point", lat: fromLat, lon: fromLon },
            to: boardStop
          },
          {
            type: "BUS",
            instruction: `Take bus ${r.name} from ${boardStop.name} to ${alightStop.name}`,
            routeId: rid,
            routeName: r.name,
            boardStop,
            alightStop,
            waitMinutes: waitMins,
            rideMinutes: trafficEstimate.totalMinutes,
            durationMinutes: trafficEstimate.totalMinutes,
            distanceKm: trafficEstimate.distanceKm,
            stopsCount: intermediateStops.length,
            intermediateStops,
            polyline,
            liveBuses: activeBusesOnRoute
          },
          {
            type: "WALK",
            instruction: `Walk from ${alightStop.name} to ${toName || 'Destination'}`,
            distanceKm: walkFromAlightDist,
            durationMinutes: walkFromAlightMins,
            from: alightStop,
            to: { name: toName || "Destination", lat: toLat, lon: toLon }
          }
        ]
      });
    }
  }

  directOptions.sort((a, b) => a.totalDurationMinutes - b.totalDurationMinutes);

  // Transfer options
  const transferOptions = [];
  if (directOptions.length < 3) {
    const origRoutes = candidateRoutes;
    const destRoutes = new Set();
    destStops.forEach(s => (stop_routes[s.id] || []).forEach(r => destRoutes.add(r)));

    const seenTransfers = new Set();

    for (const r1 of origRoutes) {
      const route1 = routes[r1];
      if (!route1) continue;

      for (const r2 of destRoutes) {
        if (r1 === r2) continue;
        const route2 = routes[r2];
        if (!route2) continue;

        const commonStops = route1.stops.filter(sid => route2.stops.includes(sid));
        for (const tSid of commonStops) {
          const tStop = stops[tSid];
          if (!tStop) continue;

          const oIdx = route1.stops.findIndex(sid => originStopIds.has(sid));
          const tIdx1 = route1.stops.indexOf(tSid);
          const tIdx2 = route2.stops.indexOf(tSid);
          const dIdx = route2.stops.findIndex(sid => destStopIds.has(sid));

          if (oIdx !== -1 && tIdx1 > oIdx && dIdx !== -1 && dIdx > tIdx2) {
            const transferKey = `${route1.name}-${route2.name}-${tStop.name}`;
            if (seenTransfers.has(transferKey)) continue;
            seenTransfers.add(transferKey);

            const board1Stop = stops[route1.stops[oIdx]];
            const alight2Stop = stops[route2.stops[dIdx]];

            const l1Stops = route1.stops.slice(oIdx, tIdx1 + 1).map(sid => stops[sid]);
            const l2Stops = route2.stops.slice(tIdx2, dIdx + 1).map(sid => stops[sid]);

            let d1 = 0;
            for (let i = 1; i < l1Stops.length; i++) d1 += haversineKm(l1Stops[i-1].lat, l1Stops[i-1].lon, l1Stops[i].lat, l1Stops[i].lon);
            let d2 = 0;
            for (let i = 1; i < l2Stops.length; i++) d2 += haversineKm(l2Stops[i-1].lat, l2Stops[i-1].lon, l2Stops[i].lat, l2Stops[i].lon);

            const est1 = trafficModel.estimateBusSegment({ distanceKm: d1, stops: l1Stops, departureHour });
            const est2 = trafficModel.estimateBusSegment({ distanceKm: d2, stops: l2Stops, departureHour });

            const walk1 = trafficModel.calculateWalkTime(origDistMap[board1Stop.id] || 0.3);
            const walk2 = trafficModel.calculateWalkTime(destDistMap[alight2Stop.id] || 0.3);
            const transferWaitMins = trafficModel.estimateWaitTime({ routeId: r2, departureHour });
            const transferBufferMins = 3;

            const wait1 = trafficModel.estimateWaitTime({ routeId: r1, departureHour });
            const totalMins = walk1 + wait1 + est1.totalMinutes + transferBufferMins + transferWaitMins + est2.totalMinutes + walk2;

            const polyline = [...l1Stops.map(s => [s.lat, s.lon]), ...l2Stops.map(s => [s.lat, s.lon])];

            transferOptions.push({
              id: `transfer-${r1}-${r2}-${tSid}`,
              type: "TRANSFER",
              routeName: `${route1.name} ➔ ${route2.name}`,
              transferHub: tStop.name,
              totalDurationMinutes: totalMins,
              totalDistanceKm: Math.round((d1 + d2 + 0.4) * 10) / 10,
              fare: {
                nonAc: trafficModel.calculateFare(d1, false) + trafficModel.calculateFare(d2, false),
                ac: trafficModel.calculateFare(d1, true) + trafficModel.calculateFare(d2, true)
              },
              trafficCondition: {
                congestionLevel: est1.congestionLevel === 'heavy' || est2.congestionLevel === 'heavy' ? 'heavy' : 'moderate',
                congestionFactor: Math.max(est1.congestionFactor, est2.congestionFactor),
                effectiveCommercialSpeedKmH: Math.round(((d1 + d2) / ((est1.totalMinutes + est2.totalMinutes) / 60)) * 10) / 10
              },
              legs: [
                {
                  type: "WALK",
                  instruction: `Walk to ${board1Stop.name}`,
                  distanceKm: origDistMap[board1Stop.id] || 0.3,
                  durationMinutes: walk1,
                  from: { name: fromName || "Start", lat: fromLat, lon: fromLon },
                  to: board1Stop
                },
                {
                  type: "BUS",
                  instruction: `Take ${route1.name} from ${board1Stop.name} to ${tStop.name}`,
                  routeId: r1,
                  routeName: route1.name,
                  boardStop: board1Stop,
                  alightStop: tStop,
                  waitMinutes: wait1,
                  rideMinutes: est1.totalMinutes,
                  durationMinutes: est1.totalMinutes,
                  distanceKm: Math.round(d1 * 10) / 10,
                  stopsCount: l1Stops.length,
                  intermediateStops: l1Stops,
                  polyline: l1Stops.map(s => [s.lat, s.lon])
                },
                {
                  type: "TRANSFER",
                  instruction: `Transfer at ${tStop.name} (Wait ~${transferWaitMins} mins for ${route2.name})`,
                  durationMinutes: transferBufferMins + transferWaitMins,
                  hub: tStop
                },
                {
                  type: "BUS",
                  instruction: `Take ${route2.name} from ${tStop.name} to ${alight2Stop.name}`,
                  routeId: r2,
                  routeName: route2.name,
                  boardStop: tStop,
                  alightStop: alight2Stop,
                  waitMinutes: 0,
                  rideMinutes: est2.totalMinutes,
                  durationMinutes: est2.totalMinutes,
                  distanceKm: Math.round(d2 * 10) / 10,
                  stopsCount: l2Stops.length,
                  intermediateStops: l2Stops,
                  polyline: l2Stops.map(s => [s.lat, s.lon])
                },
                {
                  type: "WALK",
                  instruction: `Walk from ${alight2Stop.name} to ${toName || 'Destination'}`,
                  distanceKm: destDistMap[alight2Stop.id] || 0.3,
                  durationMinutes: walk2,
                  from: alight2Stop,
                  to: { name: toName || "Destination", lat: toLat, lon: toLon }
                }
              ]
            });

            if (transferOptions.length >= 3) break;
          }
        }
        if (transferOptions.length >= 3) break;
      }
      if (transferOptions.length >= 3) break;
    }
  }

  transferOptions.sort((a, b) => a.totalDurationMinutes - b.totalDurationMinutes);
  const allOptions = [...directOptions.slice(0, 3), ...transferOptions.slice(0, 2)];

  return { options: allOptions };
}

/**
 * Public planJourney API with departure advisor
 */
function planJourney({ fromLat, fromLon, fromName, toLat, toLon, toName, departureHour = 9, liveBuses = [] }) {
  const result = planJourneyCore({ fromLat, fromLon, fromName, toLat, toLon, toName, departureHour, liveBuses });
  if (!result.options || result.options.length === 0) {
    return {
      error: `No transit options found between ${fromName || 'Origin'} and ${toName || 'Destination'}. Please select closer stops.`
    };
  }

  // Generate predictive AI departure time advice
  const departureAdvisor = getDepartureAdvisor({
    fromLat, fromLon, fromName, toLat, toLon, toName,
    baseHour: departureHour, liveBuses
  });

  return {
    origin: { name: fromName || "Origin", lat: fromLat, lon: fromLon },
    destination: { name: toName || "Destination", lat: toLat, lon: toLon },
    departureHour,
    optionsCount: result.options.length,
    options: result.options,
    departureAdvisor
  };
}

module.exports = {
  haversineKm,
  findNearbyStops,
  planJourney,
  getDepartureAdvisor
};
