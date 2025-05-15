# Safe Route

A full-stack web application designed for India that helps users find the safest and fastest routes for travel.

## Features

- **Geolocation Integration**: Automatically detects and marks user's current location on the map
- **Road Rating System**: Users can rate roads as "Good" or "Bad" to help others
- **Smart Routing**: Uses A* (A-star) algorithm to calculate the safest + fastest route
- **Traffic Visualization**: Shows traffic status with color coding (Green/Yellow/Red)
- **India-Specific**: Designed specifically for Indian geographical boundaries

## Tech Stack

### Frontend
- React (desktop-first layout with responsive design)
- Leaflet with OpenStreetMap for mapping
- Tailwind CSS for styling

### Backend
- Node.js with Express
- MongoDB for data storage
- RESTful API architecture

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or Atlas connection)

### Installation

1. Clone the repository
```
git clone <repository-url>
cd safe-route
```

2. Install server dependencies
```
cd server
npm install
```

3. Install client dependencies
```
cd ../client
npm install
```

4. Create a `.env` file in the server directory with the following variables:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/safe-route
```

### Running the Application

1. Start the server
```
cd server
npm run dev
```

2. Start the client
```
cd ../client
npm start
```

3. Open your browser and navigate to `http://localhost:3000`

## Usage

1. Allow location access when prompted
2. Search for a destination using the sidebar
3. The app will calculate and display the safest route
4. You can rate road segments by clicking on them
5. Traffic conditions are displayed with color-coded overlays

## Dependencies

### Frontend
- React
- React Leaflet
- Axios
- Tailwind CSS

### Backend
- Express
- Mongoose
- Cors
- Dotenv
- Morgan

## License

This project is licensed under the ISC License.

## Acknowledgments

- OpenStreetMap for map data
- Leaflet for map visualization
