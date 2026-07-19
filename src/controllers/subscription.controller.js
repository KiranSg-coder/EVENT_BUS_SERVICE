// controllers/subscription.controller.js
const subscriptionService = require('../services/subscriptionService');

// API 4: POST /subscription/register
const registerSubscription = async (req, res) => {
  try {
    const {
      eventType,
      subscriberName,
      webhookUrl,
      serviceType,
      priority,
      maxRetries,
      timeoutMs
    } = req.body;
    
    // Validation
    if (!eventType || !subscriberName || !webhookUrl || !serviceType) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'eventType, subscriberName, webhookUrl, and serviceType are required'
        }
      });
    }
    
    const result = await subscriptionService.registerSubscription({
      eventType,
      subscriberName,
      webhookUrl,
      serviceType,
      priority,
      maxRetries,
      timeoutMs
    });
    
    return res.status(200).json({
      success: true,
      data: {
        action: result.action,
        subscriptionId: result.subscriptionId,
        eventType,
        subscriberName
      }
    });
    
  } catch (error) {
    console.error('[SubscriptionController] Register error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to register subscription'
      }
    });
  }
};

// API 5: GET /subscription/list
const listSubscriptions = async (req, res) => {
  try {
    const { eventType, isActive } = req.query;
    
    const subscriptions = await subscriptionService.getSubscriptions({
      eventType,
      isActive: isActive !== undefined ? (isActive === 'true') : null
    });
    
    return res.status(200).json({
      success: true,
      data: {
        subscriptions: subscriptions.map(s => ({
          subscriptionId: s.SUBSCRIPTIONID,
          eventType: s.EVENTTYPE,
          subscriberName: s.SUBSCRIBERNAME,
          webhookUrl: s.WEBHOOKURL,
          serviceType: s.SERVICETYPE,
          priority: s.PRIORITY,
          retryPolicy: s.RETRYPOLICY,
          maxRetries: s.MAXRETRIES,
          timeoutMs: s.TIMEOUTMS,
          isActive: Boolean(s.ISACTIVE),
          createdDate: s.CREATEDDATE,
          updatedDate: s.UPDATEDDATE
        })),
        total: subscriptions.length
      }
    });
    
  } catch (error) {
    console.error('[SubscriptionController] List error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to list subscriptions'
      }
    });
  }
};

// API 6: PUT /subscription/:subscriptionId/toggle
const toggleSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { isActive } = req.body;
    
    if (isActive === undefined) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ISACTIVE',
          message: 'isActive is required'
        }
      });
    }
    
    await subscriptionService.toggleSubscription(parseInt(subscriptionId), isActive);
    
    return res.status(200).json({
      success: true,
      data: {
        subscriptionId: parseInt(subscriptionId),
        isActive,
        updated: true
      }
    });
    
  } catch (error) {
    console.error('[SubscriptionController] Toggle error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to toggle subscription'
      }
    });
  }
};

// API 7: DELETE /subscription/:subscriptionId
const deleteSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    
    await subscriptionService.deleteSubscription(parseInt(subscriptionId));
    
    return res.status(200).json({
      success: true,
      data: {
        subscriptionId: parseInt(subscriptionId),
        deleted: true
      }
    });
    
  } catch (error) {
    console.error('[SubscriptionController] Delete error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete subscription'
      }
    });
  }
};

module.exports = {
  registerSubscription,
  listSubscriptions,
  toggleSubscription,
  deleteSubscription
};