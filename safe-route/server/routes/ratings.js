const express = require('express');
const router = express.Router();
const ratingsController = require('../controllers/ratingsController');

// Get all ratings
router.get('/', ratingsController.getAllRatings);

// Get ratings within a bounding box
router.get('/bounds', ratingsController.getRatingsInBounds);

// Add a new rating
router.post('/', ratingsController.addRating);

// Rate a road segment
router.post('/rate', ratingsController.addRating);

// Update traffic status
router.patch('/:roadId/traffic', ratingsController.updateTrafficStatus);

module.exports = router;
