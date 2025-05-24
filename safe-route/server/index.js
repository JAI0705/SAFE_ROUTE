require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const functions = require('firebase-functions');

// Import routes
const routesRouter = require('./routes/routes');
const ratingsRouter = require('./routes/ratings');

const app = express();

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api/routes', routesRouter);
app.use('/api/routes/calculate', routesRouter);
app.use('/api/ratings', ratingsRouter);

// Root route
app.get('/', (req, res) => {
  res.send('Safe Route API is running');
});

app.get('/api', (req, res) => {
  res.json({ message: 'Safe Route API is running' });
});

// Debug route to test API connectivity
app.get('/api/test', (req, res) => {
  res.json({ success: true, message: 'API is working correctly' });
});

// For demo purposes, we'll skip the MongoDB connection
console.log('Running in demo mode without Firebase Firestore');

// Export the Express app as a Firebase Function
exports.api = functions.https.onRequest(app);

// For local development, uncomment this:
// if (process.env.NODE_ENV !== 'production') {
//   const PORT = process.env.PORT || 5000;
//   app.listen(PORT, () => {
//     console.log(`Server running on port ${PORT}`);
//   });
// }
