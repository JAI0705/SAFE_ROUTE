const mongoose = require('mongoose');

const RoadRatingSchema = new mongoose.Schema({
  roadId: {
    type: String,
    required: true
  },
  coordinates: {
    start: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true }
    },
    end: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true }
    }
  },
  rating: {
    type: String,
    enum: ['Good', 'Bad'],
    required: true
  },
  trafficStatus: {
    type: String,
    enum: ['Smooth', 'Moderate', 'Congested'],
    default: 'Moderate'
  },
  userId: {
    type: String,
    default: 'anonymous'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create a compound index for the road segment
RoadRatingSchema.index({ 
  'coordinates.start.lat': 1, 
  'coordinates.start.lng': 1,
  'coordinates.end.lat': 1,
  'coordinates.end.lng': 1
});

module.exports = mongoose.model('RoadRating', RoadRatingSchema);
