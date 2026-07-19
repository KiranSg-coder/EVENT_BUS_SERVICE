// controllers/admin.controller.js
const { QueryTypes } = require('sequelize');
const sequelize = require('../config/database');
const deliveryService = require('../services/deliveryService');

// API 11: GET /admin/dead-letter-queue
const getDeadLetterQueue = async (req, res) => {
  try {
    const { resolved = 'false', limit = 100 } = req.query;
    
    const deadLetters = await sequelize.query(
      `EXEC USP_GET_DEAD_LETTER_QUEUE 
        @RESOLVED = :resolved,
        @LIMIT = :limit`,
      {
        replacements: {
          resolved: resolved === 'true' ? 1 : 0,
          limit: parseInt(limit)
        },
        type: QueryTypes.SELECT
      }
    );
    
    return res.status(200).json({
      success: true,
      data: {
        deadLetters: deadLetters.map(dl => ({
          deadLetterId: dl.DEADLETTERID,
          eventId: dl.EVENTID,
          eventType: dl.EVENTTYPE,
          subscriberName: dl.SUBSCRIBERNAME,
          webhookUrl: dl.WEBHOOKURL,
          reason: dl.REASON,
          totalAttempts: dl.TOTALATTEMPTS,
          firstAttempt: dl.FIRSTATTEMPT,
          lastAttempt: dl.LASTATTEMPT,
          lastError: dl.LASTERROR,
          payload: JSON.parse(dl.PAYLOAD),
          resolved: Boolean(dl.RESOLVED),
          resolvedAt: dl.RESOLVEDAT,
          resolvedBy: dl.RESOLVEDBY,
          createdAt: dl.CREATEDAT
        })),
        total: deadLetters.length
      }
    });
    
  } catch (error) {
    console.error('[AdminController] Get dead letter queue error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get dead letter queue'
      }
    });
  }
};

// API 12: POST /admin/dead-letter-queue/:deadLetterId/retry
const retryDeadLetter = async (req, res) => {
  try {
    const { deadLetterId } = req.params;
    const { reason = 'Manual retry by admin' } = req.body;
    
    console.log(`[Admin] 🔄 Retrying dead letter: ${deadLetterId}`);
    
    // Get dead letter details
    const deadLetter = await sequelize.query(
      `SELECT * FROM EVENT_DEAD_LETTER WHERE DEADLETTERID = :deadLetterId`,
      {
        replacements: { deadLetterId: parseInt(deadLetterId) },
        type: QueryTypes.SELECT
      }
    );
    
    if (!deadLetter.length) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'DEAD_LETTER_NOT_FOUND',
          message: 'Dead letter not found'
        }
      });
    }
    
    const dl = deadLetter[0];
    
    // Create a new delivery record (reset attempts)
    const newDelivery = await sequelize.query(
      `INSERT INTO EVENT_DELIVERY 
       (EVENTID, SUBSCRIPTIONID, STATUS, ATTEMPTCOUNT, NEXTRETRY)
       VALUES (:eventId, :subscriptionId, 'PENDING', 0, SYSUTCDATETIME())`,
      {
        replacements: {
          eventId: dl.EVENTID,
          subscriptionId: dl.SUBSCRIPTIONID
        },
        type: QueryTypes.INSERT
      }
    );
    
    const deliveryId = newDelivery[0];
    
    console.log(`[Admin] ✅ New delivery created: ${deliveryId}`);
    
    return res.status(200).json({
      success: true,
      data: {
        deadLetterId: parseInt(deadLetterId),
        deliveryId: deliveryId,
        status: 'QUEUED_FOR_RETRY',
        message: 'Event queued for retry'
      }
    });
    
  } catch (error) {
    console.error('[AdminController] Retry dead letter error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retry dead letter'
      }
    });
  }
};

// API 13: POST /admin/dead-letter-queue/:deadLetterId/resolve
const resolveDeadLetter = async (req, res) => {
  try {
    const { deadLetterId } = req.params;
    const { resolvedBy, resolutionNotes } = req.body;
    
    if (!resolvedBy) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_RESOLVED_BY',
          message: 'resolvedBy is required'
        }
      });
    }
    
    console.log(`[Admin] ✅ Resolving dead letter: ${deadLetterId}`);
    
    await sequelize.query(
      `UPDATE EVENT_DEAD_LETTER
       SET RESOLVED = 1,
           RESOLVEDAT = SYSUTCDATETIME(),
           RESOLVEDBY = :resolvedBy,
           RESOLUTIONNOTES = :resolutionNotes
       WHERE DEADLETTERID = :deadLetterId`,
      {
        replacements: {
          deadLetterId: parseInt(deadLetterId),
          resolvedBy,
          resolutionNotes: resolutionNotes || null
        },
        type: QueryTypes.UPDATE
      }
    );
    
    return res.status(200).json({
      success: true,
      data: {
        deadLetterId: parseInt(deadLetterId),
        resolved: true,
        resolvedAt: new Date().toISOString(),
        resolvedBy
      }
    });
    
  } catch (error) {
    console.error('[AdminController] Resolve dead letter error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to resolve dead letter'
      }
    });
  }
};

// API 14: POST /admin/event-replay
const replayEvents = async (req, res) => {
  try {
    const { eventIds, targetSubscribers, reason } = req.body;
    
    if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_EVENT_IDS',
          message: 'eventIds must be a non-empty array'
        }
      });
    }
    
    console.log(`[Admin] 🔄 Replaying ${eventIds.length} events`);
    console.log(`[Admin] 🎯 Target subscribers:`, targetSubscribers);
    console.log(`[Admin] 📝 Reason:`, reason);
    
    let eventsQueued = 0;
    
    for (const eventId of eventIds) {
      // Get event details
      const event = await sequelize.query(
        `SELECT * FROM EVENT_LOG WHERE EVENTID = :eventId`,
        {
          replacements: { eventId },
          type: QueryTypes.SELECT
        }
      );
      
      if (!event.length) {
        console.log(`[Admin] ⚠️ Event ${eventId} not found, skipping`);
        continue;
      }
      
      // Get subscriptions (filter by target subscribers if provided)
      let subscriptions;
      if (targetSubscribers && targetSubscribers.length > 0) {
        subscriptions = await sequelize.query(
          `SELECT * FROM EVENT_SUBSCRIPTION 
           WHERE EVENTTYPE = :eventType 
             AND SUBSCRIBERNAME IN (:targetSubscribers)
             AND ISACTIVE = 1`,
          {
            replacements: {
              eventType: event[0].EVENTTYPE,
              targetSubscribers
            },
            type: QueryTypes.SELECT
          }
        );
      } else {
        subscriptions = await sequelize.query(
          `SELECT * FROM EVENT_SUBSCRIPTION 
           WHERE EVENTTYPE = :eventType 
             AND ISACTIVE = 1`,
          {
            replacements: { eventType: event[0].EVENTTYPE },
            type: QueryTypes.SELECT
          }
        );
      }
      
      // Create new delivery records
      for (const subscription of subscriptions) {
        await sequelize.query(
          `INSERT INTO EVENT_DELIVERY 
           (EVENTID, SUBSCRIPTIONID, STATUS, ATTEMPTCOUNT, NEXTRETRY)
           VALUES (:eventId, :subscriptionId, 'PENDING', 0, SYSUTCDATETIME())`,
          {
            replacements: {
              eventId,
              subscriptionId: subscription.SUBSCRIPTIONID
            },
            type: QueryTypes.INSERT
          }
        );
        
        eventsQueued++;
      }
    }
    
    console.log(`[Admin] ✅ ${eventsQueued} deliveries queued for replay`);
    
    return res.status(200).json({
      success: true,
      data: {
        totalEvents: eventIds.length,
        eventsQueued,
        targetSubscribers: targetSubscribers || 'ALL',
        message: 'Events queued for replay'
      }
    });
    
  } catch (error) {
    console.error('[AdminController] Replay events error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to replay events'
      }
    });
  }
};

// API 15: DELETE /admin/events/cleanup
const cleanupOldEvents = async (req, res) => {
  try {
    const { olderThanDays } = req.query;
    
    if (!olderThanDays) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_OLDER_THAN_DAYS',
          message: 'olderThanDays query parameter is required'
        }
      });
    }
    
    const days = parseInt(olderThanDays);
    
    console.log(`[Admin] 🗑️ Cleaning up events older than ${days} days`);
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    // Delete old deliveries first (foreign key constraint)
    const deliveriesDeleted = await sequelize.query(
      `DELETE FROM EVENT_DELIVERY 
       WHERE EVENTID IN (
         SELECT EVENTID FROM EVENT_LOG 
         WHERE PUBLISHEDAT < :cutoffDate
       )`,
      {
        replacements: { cutoffDate },
        type: QueryTypes.DELETE
      }
    );
    
    // Delete old events
    const eventsDeleted = await sequelize.query(
      `DELETE FROM EVENT_LOG 
       WHERE PUBLISHEDAT < :cutoffDate`,
      {
        replacements: { cutoffDate },
        type: QueryTypes.DELETE
      }
    );
    
    // Get oldest event retained
    const oldestEvent = await sequelize.query(
      `SELECT MIN(PUBLISHEDAT) AS OldestEvent FROM EVENT_LOG`,
      { type: QueryTypes.SELECT }
    );
    
    console.log(`[Admin] ✅ Cleanup complete: ${eventsDeleted[1]} events deleted`);
    
    return res.status(200).json({
      success: true,
      data: {
        eventsDeleted: eventsDeleted[1],
        deliveriesDeleted: deliveriesDeleted[1],
        oldestEventRetained: oldestEvent[0].OldestEvent,
        message: 'Cleanup completed successfully'
      }
    });
    
  } catch (error) {
    console.error('[AdminController] Cleanup error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to cleanup old events'
      }
    });
  }
};

module.exports = {
  getDeadLetterQueue,
  retryDeadLetter,
  resolveDeadLetter,
  replayEvents,
  cleanupOldEvents
};