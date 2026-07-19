// services/publisherService.js
const { QueryTypes } = require('sequelize');
const sequelize = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class PublisherService {
  
  /**
   * Publish an event to the event bus
   * @param {object} event - Event data
   * @returns {Promise<object>} - Published event details
   */
  async publishEvent(event) {
    const {
      eventType,
      eventCategory,
      sourceSystem,
      userId = null,
      entityType = null,
      entityId = null,
      payload,
      metadata = null,
      publishedBy = null,
      correlationId = null
    } = event;
    
    // Generate correlation ID if not provided
    const finalCorrelationId = correlationId || uuidv4();
    
    console.log(`[Publisher] 📤 Publishing event: ${eventType}`);
    console.log(`[Publisher] 🆔 Correlation ID: ${finalCorrelationId}`);
    console.log(`[Publisher] 👤 User ID: ${userId}`);
    console.log(`[Publisher] 📦 Payload:`, payload);
    
    try {
      const result = await sequelize.query(
        `EXEC USP_PUBLISH_EVENT 
          @EVENTTYPE = :eventType,
          @EVENTCATEGORY = :eventCategory,
          @SOURCESYSTEM = :sourceSystem,
          @CORRELATIONID = :correlationId,
          @USERID = :userId,
          @ENTITYTYPE = :entityType,
          @ENTITYID = :entityId,
          @PAYLOAD = :payload,
          @METADATA = :metadata,
          @PUBLISHEDBY = :publishedBy`,
        {
          replacements: {
            eventType,
            eventCategory,
            sourceSystem,
            correlationId: finalCorrelationId,
            userId,
            entityType,
            entityId,
            payload: JSON.stringify(payload),
            metadata: metadata ? JSON.stringify(metadata) : null,
            publishedBy
          },
          type: QueryTypes.SELECT
        }
      );
      
      const publishResult = result[0];
      
      console.log(`[Publisher] ✅ Event published successfully`);
      console.log(`[Publisher] 📨 Event ID: ${publishResult.EventId}`);
      console.log(`[Publisher] 👥 Subscribers: ${publishResult.SubscriberCount}`);
      
      return {
        success: true,
        eventId: publishResult.EventId,
        eventType: publishResult.EventType,
        subscriberCount: publishResult.SubscriberCount,
        correlationId: finalCorrelationId,
        publishedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`[Publisher] ❌ Failed to publish event:`, error);
      throw error;
    }
  }
  
  /**
   * Get event history
   */
  async getEventHistory(filters) {
    const { eventType = null, userId = null, limit = 50, offset = 0 } = filters;
    
    try {
      const result = await sequelize.query(
        `EXEC USP_GET_EVENT_HISTORY 
          @EVENTTYPE = :eventType,
          @USERID = :userId,
          @LIMIT = :limit,
          @OFFSET = :offset`,
        {
          replacements: { eventType, userId, limit, offset },
          type: QueryTypes.SELECT
        }
      );
      
      return result;
      
    } catch (error) {
      console.error('[Publisher] Error getting event history:', error);
      throw error;
    }
  }
  
  /**
   * Get event by ID
   */
  async getEventById(eventId) {
    try {
      const event = await sequelize.query(
        `SELECT * FROM EVENT_LOG WHERE EVENTID = :eventId`,
        {
          replacements: { eventId },
          type: QueryTypes.SELECT
        }
      );
      
      if (!event.length) {
        return null;
      }
      
      // Get deliveries for this event
      const deliveries = await sequelize.query(
        `SELECT 
          ED.DELIVERYID,
          ED.STATUS,
          ED.ATTEMPTCOUNT,
          ED.DELIVEREDAT,
          ED.DURATIONMS,
          ES.SUBSCRIBERNAME
         FROM EVENT_DELIVERY ED
         INNER JOIN EVENT_SUBSCRIPTION ES ON ED.SUBSCRIPTIONID = ES.SUBSCRIPTIONID
         WHERE ED.EVENTID = :eventId`,
        {
          replacements: { eventId },
          type: QueryTypes.SELECT
        }
      );
      
      return {
        event: event[0],
        deliveries
      };
      
    } catch (error) {
      console.error('[Publisher] Error getting event by ID:', error);
      throw error;
    }
  }
}

module.exports = new PublisherService();