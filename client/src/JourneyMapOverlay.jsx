import { useEffect } from "react";
import { useMap, Polyline, CircleMarker, Popup, Tooltip } from "react-leaflet";
import L from "leaflet";

function JourneyMapOverlay({ selectedOption, originPos, destPos }) {
  const map = useMap();

  useEffect(() => {
    if (!selectedOption) return;

    const points = [];
    if (originPos) points.push(originPos);
    if (destPos) points.push(destPos);

    selectedOption.legs.forEach(leg => {
      if (leg.polyline && leg.polyline.length > 0) {
        leg.polyline.forEach(p => points.push(p));
      }
    });

    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, selectedOption, originPos, destPos]);

  if (!selectedOption) return null;

  return (
    <>
      {/* Origin Pin */}
      {originPos && (
        <CircleMarker
          center={originPos}
          radius={8}
          pathOptions={{ color: "#1e3a8a", fillColor: "#3b82f6", fillOpacity: 1, weight: 3 }}
        >
          <Tooltip permanent direction="top" offset={[0, -8]}>
            Origin
          </Tooltip>
        </CircleMarker>
      )}

      {/* Destination Pin */}
      {destPos && (
        <CircleMarker
          center={destPos}
          radius={8}
          pathOptions={{ color: "#991b1b", fillColor: "#ef4444", fillOpacity: 1, weight: 3 }}
        >
          <Tooltip permanent direction="top" offset={[0, -8]}>
            Destination
          </Tooltip>
        </CircleMarker>
      )}

      {/* Render each leg */}
      {selectedOption.legs.map((leg, idx) => {
        if (leg.type === "WALK") {
          const walkLine = [
            [leg.from.lat, leg.from.lon],
            [leg.to.lat, leg.to.lon]
          ];
          return (
            <Polyline
              key={`walk-${idx}`}
              positions={walkLine}
              pathOptions={{ color: "#64748b", weight: 4, dashArray: "6, 8" }}
            >
              <Popup>
                <strong>{leg.instruction}</strong><br />
                {leg.distanceKm} km · ~{leg.durationMinutes} mins walk
              </Popup>
            </Polyline>
          );
        }

        if (leg.type === "BUS" && leg.polyline) {
          const busColor = idx === 1 ? "#059669" : "#2563eb";
          return (
            <div key={`bus-group-${idx}`}>
              <Polyline
                positions={leg.polyline}
                pathOptions={{ color: busColor, weight: 6, opacity: 0.85 }}
              >
                <Popup>
                  <strong>{leg.routeName}</strong><br />
                  From: {leg.boardStop.name}<br />
                  To: {leg.alightStop.name}<br />
                  Ride Time: ~{leg.rideMinutes} mins ({leg.distanceKm} km)<br />
                  Wait: ~{leg.waitMinutes} mins
                </Popup>
              </Polyline>

              {/* Boarding Stop */}
              <CircleMarker
                center={[leg.boardStop.lat, leg.boardStop.lon]}
                radius={7}
                pathOptions={{ color: "#ffffff", fillColor: busColor, fillOpacity: 1, weight: 2 }}
              >
                <Popup>
                  <strong>Boarding Stop:</strong> {leg.boardStop.name}<br />
                  Take Bus: {leg.routeName}
                </Popup>
              </CircleMarker>

              {/* Alight Stop */}
              <CircleMarker
                center={[leg.alightStop.lat, leg.alightStop.lon]}
                radius={7}
                pathOptions={{ color: "#ffffff", fillColor: "#d97706", fillOpacity: 1, weight: 2 }}
              >
                <Popup>
                  <strong>Alight Stop:</strong> {leg.alightStop.name}
                </Popup>
              </CircleMarker>

              {/* Intermediate stops as smaller dots */}
              {leg.intermediateStops && leg.intermediateStops.slice(1, -1).map((s, sIdx) => (
                <CircleMarker
                  key={`stop-${sIdx}`}
                  center={[s.lat, s.lon]}
                  radius={4}
                  pathOptions={{ color: busColor, fillColor: "#ffffff", fillOpacity: 0.9, weight: 1.5 }}
                >
                  <Tooltip direction="top" offset={[0, -4]}>
                    {s.name}
                  </Tooltip>
                </CircleMarker>
              ))}
            </div>
          );
        }

        return null;
      })}
    </>
  );
}

export default JourneyMapOverlay;
