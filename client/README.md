# SmartBus Delhi – Real-Time Bus Traffic Model & Journey Planner

SmartBus Delhi is a hackathon prototype that demonstrates a bus-tracking dashboard and a journey planner for Delhi.

## Project Features

- **Delhi bus map:** Displays demo bus locations on an interactive map using Leaflet and OpenStreetMap.
- **Simulated GPS tracking:** Five demo buses update their sample latitude and longitude every few seconds through the Node.js backend and Socket.IO.
- **Journey planner:** Enter a starting point and destination in Delhi to find a road route.
- **Route distance and duration:** Uses the OSRM routing service to display the returned route distance and estimated driving duration.
- **Dashboard:** Shows fleet and traffic overview information. Traffic percentages and fleet figures shown as sample indicators are demonstration data.

## Technology Stack

### Frontend
- React
- Vite
- JavaScript
- CSS
- Leaflet and React-Leaflet
- OpenStreetMap
- Axios
- Socket.IO Client
- Lucide React

### Backend
- Node.js
- Express
- Socket.IO
- CORS
- dotenv

### External Services
- OpenStreetMap – map tiles
- Nominatim – location search
- OSRM – road route, distance and duration

## Project Structure

```text
smartbus-delhi/
├── client/       # React + Vite frontend
│   └── src/
├── server/       # Node.js + Express + Socket.IO backend
│   └── server.js
└── README.md
```

## Run the Project Locally

You need Node.js and npm installed.

### 1. Start the backend

Open a terminal:

```powershell
cd server
npm install
node server.js
```

The backend runs at:

```text
http://localhost:5001
```

Backend API endpoints:

- `GET /` – backend status
- `GET /api/buses` – demo bus data

### 2. Start the frontend

Open a **second terminal**:

```powershell
cd client
npm install
npm run dev
```

Open the local URL printed by Vite, usually:

```text
http://localhost:5173
```

Keep both terminals running while using the application.

## Production Build

From the `client` folder, run:

```powershell
npm run build
```

Vite creates the production files in `client/dist`.

## Important Prototype Notes

- Bus GPS positions are **simulated demo data**. This prototype is not connected to an official live Delhi bus GPS feed.
- Traffic congestion percentages and some dashboard figures are **sample demonstration indicators**, not verified live traffic measurements.
- The journey route is requested from OSRM. Its displayed distance and duration are routing estimates, not a guaranteed bus timetable or real-time bus ETA.
- Location search uses Nominatim. These public services may have usage limits and require an internet connection.
- MongoDB/Mongoose is not currently used for persistent storage in this prototype.

## Future Scope

- Integrate an authorized real-time Delhi bus GPS feed.
- Add verified traffic data and predictive congestion analysis.
- Train and integrate an AI/ML model for bus arrival-time prediction.
- Add user accounts, saved journeys and persistent database storage.
- Add bus stops, route schedules, accessibility information and notifications.

## Hackathon Demo

For the demonstration:
1. Start the backend and frontend.
2. Show the Delhi map and moving demo bus markers.
3. Open a bus marker to show its demo details.
4. Enter two Delhi locations in the journey planner.
5. Show the route line, distance and estimated driving duration.

---

**SmartBus Delhi** – A prototype for smarter, data-informed public transport planning.
