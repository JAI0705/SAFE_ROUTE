const express = require('express');
const router = express.Router();
const routesController = require('../controllers/routesController');

// Calculate route using A* algorithm
router.post('/calculate', routesController.calculateRoute);

// Get traffic data for a specific area
router.get('/traffic', routesController.getTrafficData);

module.exports = router;
