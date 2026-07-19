// services/deliveryService.js
const { QueryTypes } = require('sequelize');
const sequelize = require('../config/database');
const httpClient = require('../utils/httpClient');

class DeliveryService {
  
  /**
   * Process pending event deliveries
   */
  async processPendingDeliveries() {
    try {
      // Get pending deliveries
      const deliveries = await sequelize.query(
        `EXEC USP_GET_PENDING_DELIVERIES @LIMIT = 100`,
        { type: QueryTypes.SELECT }
      );
      
      if (!deliveries.length) {
        return { processed: 0, successful: 0, failed: 0 };
      }
      
      console.log(`[Delivery] 📦 Processing ${deliveries.length} pending deliveries`);
      
      // Process each delivery
      const results = await Promise.allSettled(
        deliveries.map(delivery => this.deliverEvent(delivery))
      );
      
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.filter(r => r.status === 'rejected' || !r.value.success).length;
      
      console.log(`[Delivery] ✅ Successful: ${successful}, ❌ Failed: ${failed}`);
      
      return { processed: deliveries.length, successful, failed };
      
    } catch (error) {
      console.error('[Delivery] Error processing deliveries:', error);
      throw error;
    }
  }
  
  /**
   * Deliver a single event to subscriber
   */
  async deliverEvent(delivery) {
    const startTime = Date.now();
    
    console.log(`[Delivery] 📤 Delivering to: ${delivery.SUBSCRIBERNAME}`);
    console.log(`[Delivery] 🌐 URL: ${delivery.WEBHOOKURL}`);
    console.log(`[Delivery] 🔢 Attempt: ${delivery.ATTEMPTCOUNT + 1}/${delivery.MAXRETRIES}`);
    
    try {
      // Prepare webhook payload
      const webhookPayload = {
        eventId: delivery.EVENTID,
        eventType: delivery.EVENTTYPE,
        eventCategory: delivery.EVENTCATEGORY,
        sourceSystem: delivery.SOURCESYSTEM,
        userId: delivery.USERID,
        entityType: delivery.ENTITYTYPE,
        entityId: delivery.ENTITYID,
        payload: JSON.parse(delivery.PAYLOAD),
        publishedAt: delivery.PUBLISHEDAT,
        deliveryId: delivery.DELIVERYID
      };
      
      // Make HTTP request
      const response = await httpClient.post(
        delivery.WEBHOOKURL,
        webhookPayload,
        {
          timeout: delivery.TIMEOUTMS,
          headers: {
            'Content-Type': 'application/json',
            'X-Event-Type': delivery.EVENTTYPE,
            'X-Event-Id': delivery.EVENTID.toString(),
            'X-Delivery-Id': delivery.DELIVERYID.toString(),
            'X-Service-Key': process.env.INTERNAL_SERVICE_KEY
          }
        }
      );
      
      const durationMs = Date.now() - startTime;
      
      console.log(`[Delivery] ✅ Success - Status: ${response.status}, Duration: ${durationMs}ms`);
      
      // Update delivery status
      await sequelize.query(
        `EXEC USP_UPDATE_DELIVERY_STATUS 
          @DELIVERYID = :deliveryId,
          @STATUS = 'DELIVERED',
          @RESPONSESTATUSCODE = :statusCode,
          @RESPONSEBODY = :responseBody,
          @DURATIONMS = :durationMs`,
        {
          replacements: {
            deliveryId: delivery.DELIVERYID,
            statusCode: response.status,
            responseBody: JSON.stringify(response.data).substring(0, 4000),
            durationMs
          },
          type: QueryTypes.SELECT
        }
      );
      
      return { success: true, deliveryId: delivery.DELIVERYID };
      
    } catch (error) {
      const durationMs = Date.now() - startTime;
      
      console.error(`[Delivery] ❌ Failed - ${error.message}`);
      
      // Update delivery status
      await sequelize.query(
        `EXEC USP_UPDATE_DELIVERY_STATUS 
          @DELIVERYID = :deliveryId,
          @STATUS = 'FAILED',
          @RESPONSESTATUSCODE = :statusCode,
          @ERRORCODE = :errorCode,
          @ERRORMESSAGE = :errorMessage,
          @DURATIONMS = :durationMs`,
        {
          replacements: {
            deliveryId: delivery.DELIVERYID,
            statusCode: error.response?.status || null,
            errorCode: error.code || 'UNKNOWN_ERROR',
            errorMessage: error.message.substring(0, 2000),
            durationMs
          },
          type: QueryTypes.SELECT
        }
      );
      
      return { success: false, deliveryId: delivery.DELIVERYID, error: error.message };
    }
  }
}

module.exports = new DeliveryService();