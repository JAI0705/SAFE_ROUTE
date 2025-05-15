require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');

// Import routes
const routesRouter = require('./routes/routes');
const ratingsRouter = require('./routes/ratings');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api/routes', routesRouter);
app.use('/api/ratings', ratingsRouter);

// Root route
app.get('/', (req, res) => {
  res.send('Safe Route API is running');
});

// For demo purposes, we'll skip the MongoDB connection
console.log('Running in demo mode without MongoDB connection');

// In a production environment, you would connect to MongoDB like this:
// mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/safe-route', {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// })
// .then(() => console.log('Connected to MongoDB'))
// .catch(err => console.error('MongoDB connection error:', err));

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
