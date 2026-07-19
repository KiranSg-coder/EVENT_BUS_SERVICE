// controllers/event.controller.js
const publisherService = require('../services/publisherService');

// API 1: POST /event/publish
const publishEvent = async (req, res) => {
  try {
    const {
      eventType,
      eventCategory,
      sourceSystem,
      userId,
      entityType,
      entityId,
      payload,
      metadata,
      publishedBy,
      correlationId
    } = req.body;
    
    // Validation
    if (!eventType || !eventCategory || !sourceSystem || !payload) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'eventType, eventCategory, sourceSystem, and payload are required'
        }
      });
    }
    
    // Publish event
    const result = await publisherService.publishEvent({
      eventType,
      eventCategory,
      sourceSystem,
      userId,
      entityType,
      entityId,
      payload,
      metadata,
      publishedBy,
      correlationId
    });
    
    return res.status(200).json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('[EventController] Publish error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to publish event'
      }
    });
  }
};

// API 2: GET /event/history
const getEventHistory = async (req, res) => {
  try {
    const { eventType, userId, limit = 50, offset = 0 } = req.query;
    
    const events = await publisherService.getEventHistory({
      eventType,
      userId: userId ? parseInt(userId) : null,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    // Get total count
    const totalCount = events.length > 0 ? events[0].TotalEvents || events.length : 0;
    
    return res.status(200).json({
      success: true,
      data: {
        events: events.map(e => ({
          eventId: e.EVENTID,
          eventType: e.EVENTTYPE,
          eventCategory: e.EVENTCATEGORY,
          sourceSystem: e.SOURCESYSTEM,
          userId: e.USERID,
          entityType: e.ENTITYTYPE,
          entityId: e.ENTITYID,
          payload: JSON.parse(e.PAYLOAD),
          publishedAt: e.PUBLISHEDAT,
          deliveryStats: {
            total: e.TotalDeliveries,
            successful: e.SuccessfulDeliveries,
            failed: e.FailedDeliveries
          }
        })),
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: totalCount
        }
      }
    });
    
  } catch (error) {
    console.error('[EventController] Get history error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get event history'
      }
    });
  }
};

// API 3: GET /event/:eventId
const getEventById = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const result = await publisherService.getEventById(parseInt(eventId));
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'EVENT_NOT_FOUND',
          message: `Event with ID ${eventId} not found`
        }
      });
    }
    
    const event = result.event;
    
    return res.status(200).json({
      success: true,
      data: {
        eventId: event.EVENTID,
        eventType: event.EVENTTYPE,
        eventCategory: event.EVENTCATEGORY,
        sourceSystem: event.SOURCESYSTEM,
        correlationId: event.CORRELATIONID,
        userId: event.USERID,
        entityType: event.ENTITYTYPE,
        entityId: event.ENTITYID,
        payload: JSON.parse(event.PAYLOAD),
        metadata: event.METADATA ? JSON.parse(event.METADATA) : null,
        publishedAt: event.PUBLISHEDAT,
        deliveries: result.deliveries.map(d => ({
          deliveryId: d.DELIVERYID,
          subscriberName: d.SUBSCRIBERNAME,
          status: d.STATUS,
          attemptCount: d.ATTEMPTCOUNT,
          deliveredAt: d.DELIVEREDAT,
          durationMs: d.DURATIONMS
        }))
      }
    });
    
  } catch (error) {
    console.error('[EventController] Get event error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get event'
      }
    });
  }
};

module.exports = {
  publishEvent,
  getEventHistory,
  getEventById
};