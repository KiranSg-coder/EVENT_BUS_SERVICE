// services/subscriptionService.js
const { QueryTypes } = require('sequelize');
const sequelize = require('../config/database');

class SubscriptionService {
  
  /**
   * Register a new subscription
   */
  async registerSubscription(subscriptionData) {
    const {
      eventType,
      subscriberName,
      webhookUrl,
      serviceType,
      priority = 100,
      maxRetries = 3,
      timeoutMs = 5000
    } = subscriptionData;
    
    console.log(`[Subscription] 📝 Registering: ${subscriberName} for ${eventType}`);
    
    try {
      const result = await sequelize.query(
        `EXEC USP_REGISTER_SUBSCRIPTION 
          @EVENTTYPE = :eventType,
          @SUBSCRIBERNAME = :subscriberName,
          @WEBHOOKURL = :webhookUrl,
          @SERVICETYPE = :serviceType,
          @PRIORITY = :priority,
          @MAXRETRIES = :maxRetries,
          @TIMEOUTMS = :timeoutMs`,
        {
          replacements: {
            eventType,
            subscriberName,
            webhookUrl,
            serviceType,
            priority,
            maxRetries,
            timeoutMs
          },
          type: QueryTypes.SELECT
        }
      );
      
      const registrationResult = result[0];
      
      console.log(`[Subscription] ✅ ${registrationResult.Action}: ID ${registrationResult.SUBSCRIPTIONID}`);
      
      return {
        success: true,
        action: registrationResult.Action,
        subscriptionId: registrationResult.SUBSCRIPTIONID
      };
      
    } catch (error) {
      console.error('[Subscription] Error registering:', error);
      throw error;
    }
  }
  
  /**
   * Get all subscriptions
   */
  async getSubscriptions(filters = {}) {
    const { eventType = null, isActive = null } = filters;
    
    try {
      const subscriptions = await sequelize.query(
        `EXEC USP_GET_SUBSCRIPTIONS 
          @EVENTTYPE = :eventType,
          @ISACTIVE = :isActive`,
        {
          replacements: { eventType, isActive },
          type: QueryTypes.SELECT
        }
      );
      
      return subscriptions;
      
    } catch (error) {
      console.error('[Subscription] Error getting subscriptions:', error);
      throw error;
    }
  }
  
  /**
   * Toggle subscription active status
   */
  async toggleSubscription(subscriptionId, isActive) {
    try {
      await sequelize.query(
        `UPDATE EVENT_SUBSCRIPTION 
         SET ISACTIVE = :isActive,
             UPDATEDDATE = SYSUTCDATETIME()
         WHERE SUBSCRIPTIONID = :subscriptionId`,
        {
          replacements: { subscriptionId, isActive },
          type: QueryTypes.UPDATE
        }
      );
      
      console.log(`[Subscription] ✅ Subscription ${subscriptionId} ${isActive ? 'enabled' : 'disabled'}`);
      
      return { success: true };
      
    } catch (error) {
      console.error('[Subscription] Error toggling subscription:', error);
      throw error;
    }
  }
  
  /**
   * Delete subscription
   */
  async deleteSubscription(subscriptionId) {
    try {
      await sequelize.query(
        `DELETE FROM EVENT_SUBSCRIPTION WHERE SUBSCRIPTIONID = :subscriptionId`,
        {
          replacements: { subscriptionId },
          type: QueryTypes.DELETE
        }
      );
      
      console.log(`[Subscription] ✅ Subscription ${subscriptionId} deleted`);
      
      return { success: true };
      
    } catch (error) {
      console.error('[Subscription] Error deleting subscription:', error);
      throw error;
    }
  }
}

module.exports = new SubscriptionService();