<p align="center">
  <img src="https://img.shields.io/badge/Safe%20Route-Navigate%20Safely-00B894?style=for-the-badge&logo=google-maps&logoColor=white" alt="Safe Route Banner"/>
</p>

<h1 align="center">🛣️ Safe Route</h1>

<p align="center">
  <strong>Intelligent Route Safety Navigation System for India</strong>
</p>

<p align="center">
  <a href="https://safe-route-127fd.web.app/">
    <img src="https://img.shields.io/badge/🌐_Live_Demo-Visit_App-00CEC9?style=for-the-badge" alt="Live Demo"/>
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18.2.0-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React"/>
  <img src="https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js"/>
  <img src="https://img.shields.io/badge/Firebase-Firestore-FFCA28?style=flat-square&logo=firebase&logoColor=black" alt="Firebase"/>
  <img src="https://img.shields.io/badge/Leaflet-Maps-199900?style=flat-square&logo=leaflet&logoColor=white" alt="Leaflet"/>
  <img src="https://img.shields.io/badge/Tailwind-CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-ISC-blue?style=flat-square" alt="License"/>
  <img src="https://img.shields.io/badge/PRs-Welcome-brightgreen?style=flat-square" alt="PRs Welcome"/>
  <img src="https://img.shields.io/github/actions/workflow/status/owner/SAFE_ROUTE/firebase-hosting-merge.yml?style=flat-square&label=Deploy" alt="Deploy Status"/>
</p>

---

## 📋 Table of Contents

- [🎯 Problem Statement](#-problem-statement)
- [✨ Features](#-features)
- [🏗️ Architecture](#️-architecture)
- [🛠️ Tech Stack](#️-tech-stack)
- [🚀 Getting Started](#-getting-started)
- [📖 Usage Guide](#-usage-guide)
- [🔧 API Reference](#-api-reference)
- [🧪 Testing](#-testing)
- [🚢 Deployment](#-deployment)
- [🗺️ Roadmap](#️-roadmap)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

---

## 🎯 Problem Statement

<table>
<tr>
<td width="60%">

**India faces a critical road safety crisis** with over **150,000 road fatalities annually**. Traditional navigation systems focus solely on finding the shortest or fastest routes without considering safety factors.

**Safe Route** addresses this gap by creating a platform where:

- 👥 Users can **share knowledge** about road conditions and safety
- 🧠 Algorithms can **calculate routes** that balance safety with travel time
- 🚗 Travelers can make **informed decisions** based on comprehensive route information

</td>
<td width="40%">

```
🛣️ Traditional Navigation
━━━━━━━━━━━━━━━━━━━━━━━━
✓ Shortest route
✓ Fastest route
✗ Safety considerations
✗ Road condition data
✗ Crowdsourced insights

🛡️ Safe Route Navigation
━━━━━━━━━━━━━━━━━━━━━━━━
✓ Safety-prioritized routing
✓ Crowdsourced road ratings
✓ Real-time safety scores
✓ Multiple route options
✓ Community-driven data
```

</td>
</tr>
</table>

---

## ✨ Features

### 🧭 Intelligent Route Calculation

| Feature                          | Description                                                              |
| -------------------------------- | ------------------------------------------------------------------------ |
| **Safety-Prioritized Algorithm** | Custom weighted algorithm balancing **70% safety** + **30% travel time** |
| **Multiple Routing Services**    | Integration with OpenRouteService, GraphHopper, and OSRM                 |
| **Fallback Mechanisms**          | Graceful degradation when external services are unavailable              |
| **Route Caching**                | Firebase-powered route caching for improved performance                  |

### ⭐ Crowdsourced Road Ratings

```
┌─────────────────────────────────────────────────────┐
│  📍 Segment-Based Rating System                     │
│  ─────────────────────────────────────────────────  │
│  • Roads divided into ~2km segments                 │
│  • Binary "Good" or "Bad" ratings                   │
│  • Aggregated 0-100 safety scores                   │
│  • Recent ratings given higher weight               │
└─────────────────────────────────────────────────────┘
```

### 🗺️ Interactive Map Interface

- **Leaflet Integration** - High-performance map rendering with React-Leaflet
- **Visual Safety Indicators** - Color-coded route segments based on safety ratings
- **Interactive Elements** - Clickable segments for rating submission
- **Custom Markers** - Start, destination, and user location markers

### 🔐 Authentication System

- **Firebase Authentication** - Secure email/password authentication
- **Protected Routes** - Map functionality accessible only to authenticated users
- **User Data Storage** - Firestore-based user profile management
- **Location Permission** - Consent-based location access during registration

### 📍 Location Services

- **Geolocation Integration** - Automatic detection of user's current location
- **Search with Autocomplete** - Location search powered by Nominatim API
- **India-Specific Boundaries** - Optimized for Indian geographical context

---

## 🏗️ Architecture

```mermaid
graph TB
    subgraph Client["🖥️ Frontend (React)"]
        A[App.js] --> B[MapView]
        A --> C[Sidebar]
        B --> D[Leaflet Map]
        C --> E[PlaceSearch]
        A --> F[Auth Context]
    end

    subgraph Server["⚙️ Backend (Node.js/Express)"]
        G[Routes Controller] --> H[Safe Route Calculator]
        I[Ratings Controller] --> J[Road Rating Model]
        H --> K[GraphHopper Service]
        H --> L[OSRM Service]
    end

    subgraph Firebase["☁️ Firebase"]
        M[Authentication]
        N[Firestore DB]
        O[Hosting]
    end

    subgraph External["🌐 External APIs"]
        P[OpenRouteService]
        Q[GraphHopper API]
        R[OSRM API]
        S[Nominatim Geocoding]
    end

    Client <-->|REST API| Server
    Server <--> Firebase
    Server <--> External
    Client <--> M
```

### Data Flow

```
1️⃣ Location Input    → User inputs start and destination locations
2️⃣ Route Request     → Client requests route options from server
3️⃣ External API      → Server communicates with routing services
4️⃣ Safety Enhancement → Server applies safety data to routes
5️⃣ Response Delivery → Enhanced routes returned to client
6️⃣ Visualization     → Client renders routes with safety indicators
7️⃣ User Feedback     → Ratings submitted back to server for storage
```

---

## 🛠️ Tech Stack

<table>
<tr>
<td valign="top" width="50%">

### Frontend

| Technology                                                                                                             | Purpose       |
| ---------------------------------------------------------------------------------------------------------------------- | ------------- |
| ![React](https://img.shields.io/badge/-React_18-61DAFB?style=flat-square&logo=react&logoColor=black)                   | UI Framework  |
| ![Leaflet](https://img.shields.io/badge/-Leaflet-199900?style=flat-square&logo=leaflet&logoColor=white)                | Map Rendering |
| ![Tailwind](https://img.shields.io/badge/-Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)      | Styling       |
| ![React Router](https://img.shields.io/badge/-React_Router-CA4245?style=flat-square&logo=react-router&logoColor=white) | Navigation    |
| ![Axios](https://img.shields.io/badge/-Axios-5A29E4?style=flat-square&logo=axios&logoColor=white)                      | HTTP Client   |

</td>
<td valign="top" width="50%">

### Backend

| Technology                                                                                                       | Purpose          |
| ---------------------------------------------------------------------------------------------------------------- | ---------------- |
| ![Node.js](https://img.shields.io/badge/-Node.js-339933?style=flat-square&logo=node.js&logoColor=white)          | Runtime          |
| ![Express](https://img.shields.io/badge/-Express-000000?style=flat-square&logo=express&logoColor=white)          | Web Framework    |
| ![Firebase](https://img.shields.io/badge/-Firebase_Admin-FFCA28?style=flat-square&logo=firebase&logoColor=black) | Backend Services |
| ![Mongoose](https://img.shields.io/badge/-Mongoose-880000?style=flat-square&logoColor=white)                     | ODM (Future)     |

</td>
</tr>
</table>

### External Services

| Service             | Purpose                 | Documentation                                       |
| ------------------- | ----------------------- | --------------------------------------------------- |
| 🗺️ OpenRouteService | Primary routing service | [Docs](https://openrouteservice.org/dev/#/api-docs) |
| 🚗 GraphHopper      | Alternative routing     | [Docs](https://docs.graphhopper.com/)               |
| 🛣️ OSRM             | Backup routing          | [Docs](http://project-osrm.org/docs/)               |
| 📍 Nominatim        | Geocoding               | [Docs](https://nominatim.org/release-docs/latest/)  |
| 🔥 Firebase         | Auth, DB, Hosting       | [Docs](https://firebase.google.com/docs)            |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v14 or higher
- **npm** v6 or higher
- **Firebase Account** with a configured project
- **API Keys** for routing services (optional, uses public APIs by default)

### Installation

```bash
# 1️⃣ Clone the repository
git clone https://github.com/yourusername/SAFE_ROUTE.git
cd SAFE_ROUTE/safe-route

# 2️⃣ Install all dependencies (root, server, and client)
npm run install-all

# 3️⃣ Configure Firebase
# Create client/src/firebase/config.js with your Firebase config

# 4️⃣ Configure server environment
# Create server/.env with required environment variables
```

### Firebase Configuration

Create `client/src/firebase/config.js`:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
};

export default firebaseConfig;
```

### Running the Application

```bash
# 🚀 Start both server and client concurrently
npm start

# Or run separately:

# Terminal 1 - Start the server
cd server && npm run dev

# Terminal 2 - Start the client
cd client && npm start
```

The application will be available at:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000

---

## 📖 Usage Guide

### 🔑 Authentication

1. **Register** with email and password
2. **Grant location permission** during registration
3. **Login** to access the map interface

### 🗺️ Finding a Route

```
┌─────────────────────────────────────────────────────────┐
│  Step 1: Enter Start Location                          │
│  ─────────────────────────────────────────────────────  │
│  • Use "Current Location" button, OR                   │
│  • Type address in the search box                      │
├─────────────────────────────────────────────────────────┤
│  Step 2: Enter Destination                             │
│  ─────────────────────────────────────────────────────  │
│  • Type destination address                            │
│  • Select from autocomplete suggestions                │
├─────────────────────────────────────────────────────────┤
│  Step 3: Toggle Safety Priority (Optional)             │
│  ─────────────────────────────────────────────────────  │
│  • Enable for safety-prioritized routing               │
│  • Disable for fastest route                           │
├─────────────────────────────────────────────────────────┤
│  Step 4: Calculate Route                               │
│  ─────────────────────────────────────────────────────  │
│  • Click "Calculate Route" button                      │
│  • View route with safety indicators                   │
└─────────────────────────────────────────────────────────┘
```

### ⭐ Rating Road Segments

1. Calculate a route between two locations
2. Click on any segment of the displayed route
3. In the popup, rate the road as **"Good"** or **"Bad"**
4. Your rating will influence future route calculations

---

## 🔧 API Reference

### Routes API

| Endpoint                | Method | Description                        |
| ----------------------- | ------ | ---------------------------------- |
| `/api/routes/calculate` | POST   | Calculate route between two points |

**Request Body:**

```json
{
  "start": { "lat": 28.6139, "lng": 77.209 },
  "destination": { "lat": 28.5355, "lng": 77.391 },
  "prioritizeSafety": true
}
```

**Response:**

```json
{
  "success": true,
  "route": [...],
  "distance": 25.4,
  "estimatedTime": 45,
  "safetyScore": 78,
  "segments": [...]
}
```

### Ratings API

| Endpoint              | Method | Description                   |
| --------------------- | ------ | ----------------------------- |
| `/api/ratings`        | POST   | Submit a new road rating      |
| `/api/ratings/bounds` | GET    | Get ratings within map bounds |

---

## 🧪 Testing

```bash
# Run client tests
cd client && npm test

# Run server tests
cd server && npm test
```

---

## 🚢 Deployment

The application uses **Firebase Hosting** with automated CI/CD via GitHub Actions.

### Automatic Deployment

- **Merge to `main`** → Deploys to production
- **Pull Requests** → Creates preview deployments

### Manual Deployment

```bash
# Build the client
cd client && npm run build

# Deploy to Firebase
firebase deploy --only hosting
```

### Live Application

🔗 **[https://safe-route-127fd.web.app/](https://safe-route-127fd.web.app/)**

---

## 🗺️ Roadmap

### Current Status ✅

- [x] Multi-service route calculation
- [x] Crowdsourced road ratings
- [x] Firebase authentication
- [x] Interactive map interface
- [x] Safety-prioritized routing algorithm

### Upcoming Features 🚧

- [ ] **Machine Learning Integration** - Predictive safety models
- [ ] **Detailed Rating Categories** - Specific hazard types (potholes, traffic, etc.)
- [ ] **Temporal Analysis** - Time-based safety patterns (day/night, seasonal)
- [ ] **Mobile Applications** - Native iOS and Android versions
- [ ] **Offline Functionality** - Enhanced capabilities without internet
- [ ] **Vehicle System Integration** - API for in-vehicle navigation

---

## 📁 Project Structure

```
SAFE_ROUTE/
├── 📁 .github/
│   └── 📁 workflows/          # GitHub Actions CI/CD
├── 📁 safe-route/
│   ├── 📁 client/             # React Frontend
│   │   ├── 📁 public/         # Static assets
│   │   └── 📁 src/
│   │       ├── 📁 components/ # React components
│   │       ├── 📁 contexts/   # React contexts
│   │       ├── 📁 firebase/   # Firebase config & services
│   │       ├── 📁 pages/      # Page components
│   │       ├── 📁 services/   # API services
│   │       ├── 📁 styles/     # CSS styles
│   │       └── 📁 utils/      # Utility functions
│   ├── 📁 server/             # Node.js Backend
│   │   ├── 📁 controllers/    # Route handlers
│   │   ├── 📁 models/         # Data models
│   │   ├── 📁 routes/         # API routes
│   │   └── 📁 utils/          # Utility functions
│   ├── 📄 firebase.json       # Firebase configuration
│   ├── 📄 firestore.rules     # Firestore security rules
│   └── 📄 package.json        # Project dependencies
└── 📄 README.md               # You are here!
```

---

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a pull request.

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/AmazingFeature`)
3. **Commit** your changes (`git commit -m 'Add AmazingFeature'`)
4. **Push** to the branch (`git push origin feature/AmazingFeature`)
5. **Open** a Pull Request

---

## 🙏 Acknowledgments

- **OpenStreetMap** for map data
- **Leaflet** for map visualization
- **OpenRouteService** for routing API
- **Firebase** for backend services
- The research community for guidance on safety metrics

---

## 📄 License

This project is licensed under the **ISC License** - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <strong>Made with ❤️ for safer roads in India</strong>
</p>

<p align="center">
  <a href="https://safe-route-127fd.web.app/">
    <img src="https://img.shields.io/badge/🚀_Try_It_Now-safe--route--127fd.web.app-00B894?style=for-the-badge" alt="Try It Now"/>
  </a>
</p>
