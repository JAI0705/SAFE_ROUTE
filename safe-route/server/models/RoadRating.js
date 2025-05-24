/**
 * Road Rating Model - Firebase Version
 * This model handles road ratings stored in Firestore
 */
const { db } = require('../firebase');

// Collection name in Firestore
const COLLECTION = 'roadRatings';

const RoadRatingModel = {
  /**
   * Create a new road rating
   * @param {Object} ratingData - Road rating data
   * @returns {Object} - Created road rating with ID
   */
  async create(ratingData) {
    try {
      // Add timestamp if not provided
      if (!ratingData.createdAt) {
        ratingData.createdAt = new Date().toISOString();
      }
      
      const docRef = await db.collection(COLLECTION).add(ratingData);
      return { id: docRef.id, ...ratingData };
    } catch (error) {
      console.error('Error creating road rating:', error);
      throw error;
    }
  },
  
  /**
   * Get a road rating by ID
   * @param {String} id - Road rating ID
   * @returns {Object} - Road rating data
   */
  async getById(id) {
    try {
      const doc = await db.collection(COLLECTION).doc(id).get();
      
      if (!doc.exists) {
        return null;
      }
      
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      console.error('Error getting road rating:', error);
      throw error;
    }
  },
  
  /**
   * Find road ratings within geographic bounds
   * @param {Object} bounds - Geographic bounds {north, south, east, west}
   * @returns {Array} - Array of road ratings
   */
  async findByBounds(bounds) {
    try {
      const { north, south, east, west } = bounds;
      
      console.log(`Finding road ratings within bounds: N:${north}, S:${south}, E:${east}, W:${west}`);
      
      // Check if we have area field to use for more accurate querying
      let query;
      
      try {
        // Try to use the area field for more accurate querying
        query = db.collection(COLLECTION)
          .where('area.south', '<=', north) // Area's south edge is below the north boundary
          .where('area.north', '>=', south); // Area's north edge is above the south boundary
      } catch (queryError) {
        console.warn('Error with area query, falling back to coordinates query:', queryError);
        // Fallback to the original query method
        query = db.collection(COLLECTION)
          .where('coordinates.start.lat', '<=', north)
          .where('coordinates.start.lat', '>=', south);
      }
      
      const snapshot = await query.get();
      console.log(`Found ${snapshot.size} potential ratings in latitude range`);
      
      // Filter results further client-side for longitude
      const filteredRatings = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(rating => {
          // If we have area field, use it for more accurate filtering
          if (rating.area) {
            return !(rating.area.west > east || rating.area.east < west);
          }
          
          // Otherwise fall back to coordinates
          return rating.coordinates.start.lng >= west && 
                 rating.coordinates.start.lng <= east;
        });
      
      console.log(`Filtered to ${filteredRatings.length} ratings within bounds`);
      return filteredRatings;
    } catch (error) {
      console.error('Error finding road ratings by bounds:', error);
      throw error;
    }
  },
  
  /**
   * Get all road ratings
   * @returns {Array} - Array of road ratings
   */
  async findAll() {
    try {
      const snapshot = await db.collection(COLLECTION).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error finding all road ratings:', error);
      throw error;
    }
  },
  
  /**
   * Find a road rating by segment ID
   * @param {String} segmentId - Segment ID
   * @returns {Object} - Road rating data or null if not found
   */
  async findByRoadId(segmentId) {
    try {
      console.log(`Finding road rating for segment ID: ${segmentId}`);
      
      // Query for road ratings with the given segment ID
      const snapshot = await db.collection(COLLECTION)
        .where('id', '==', segmentId)
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        console.log(`No rating found for segment ID: ${segmentId}`);
        return null;
      }
      
      const doc = snapshot.docs[0];
      console.log(`Found rating for segment ID: ${segmentId}`);
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      console.error(`Error finding road rating by segment ID ${segmentId}:`, error);
      throw error;
    }
  },
  
  /**
   * Update a road rating
   * @param {String} id - Road rating ID
   * @param {Object} updateData - Data to update
   * @returns {Boolean} - Success status
   */
  async update(id, updateData) {
    try {
      await db.collection(COLLECTION).doc(id).update({
        ...updateData,
        updatedAt: new Date().toISOString()
      });
      
      return true;
    } catch (error) {
      console.error('Error updating road rating:', error);
      throw error;
    }
  },
  
  /**
   * Delete a road rating
   * @param {String} id - Road rating ID
   * @returns {Boolean} - Success status
   */
  async delete(id) {
    try {
      await db.collection(COLLECTION).doc(id).delete();
      return true;
    } catch (error) {
      console.error('Error deleting road rating:', error);
      throw error;
    }
  }
};

module.exports = RoadRatingModel;
