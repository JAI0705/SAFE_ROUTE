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
      
      // Query for road ratings within the bounds
      // Note: Firestore has limitations with compound queries
      // This is a simplified approach that may need optimization
      let query = db.collection(COLLECTION)
        .where('coordinates.start.lat', '<=', north)
        .where('coordinates.start.lat', '>=', south);
      
      const snapshot = await query.get();
      
      // Filter results further client-side for longitude
      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(rating => 
          rating.coordinates.start.lng >= west && 
          rating.coordinates.start.lng <= east
        );
    } catch (error) {
      console.error('Error finding road ratings by bounds:', error);
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
