
import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

function RoutingControl({ fromPosition, toPosition, onRouteInfo }) {
  const map = useMap();

  useEffect(() => {
    if (!fromPosition || !toPosition) return;

    const controller = new AbortController();
    let routeLayer = null;

    const getRoute = async () => {
      try {
        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${fromPosition[1]},${fromPosition[0]};${toPosition[1]},${toPosition[0]}` +
          `?overview=full&geometries=geojson`;

        const response = await fetch(url, {
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error("Route service is unavailable");
        }

        const data = await response.json();

        if (data.code !== "Ok" || !data.routes?.length) {
          throw new Error("No route found");
        }

        const route = data.routes[0];

        routeLayer = L.geoJSON(route.geometry, {
          style: {
            color: "#159c69",
            weight: 6,
            opacity: 0.85
          }
        }).addTo(map);

        map.fitBounds(routeLayer.getBounds(), {
          padding: [40, 40]
        });

        if (onRouteInfo) {
          onRouteInfo({
            distance: (route.distance / 1000).toFixed(2),
            duration: Math.round(route.duration / 60)
          });
        }

      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Route error:", error);
        }
      }
    };

    getRoute();

    return () => {
      controller.abort();

      if (routeLayer && map.hasLayer(routeLayer)) {
        map.removeLayer(routeLayer);
      }
    };
  }, [map, fromPosition, toPosition, onRouteInfo]);

  return null;
}

export default RoutingControl;
