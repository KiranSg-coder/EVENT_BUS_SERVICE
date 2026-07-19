// controllers/metrics.controller.js
const { QueryTypes } = require("sequelize");
const sequelize = require("../config/database");

// API 8: GET /metrics/delivery-stats
const getDeliveryStats = async (req, res) => {
  try {
    const { days = 7 } = req.query;

    const result = await sequelize.query(
      `EXEC USP_GET_DELIVERY_STATS @DAYS = :days`,
      {
        replacements: { days: parseInt(days) },
        type: QueryTypes.RAW,
      },
    );
    console.log(JSON.stringify(result, null, 2));
    const rows = result[0] || [];
    const overall = rows[0] || {};
    const byEventType = rows.filter((r) => r.EVENTTYPE);
    const bySubscriber = rows.filter((r) => r.SUBSCRIBERNAME);

    return res.status(200).json({
      success: true,
      data: {
        period: `Last ${days} days`,
        overall: {
          totalEvents: overall.TotalEvents || 0,
          totalDeliveries: overall.TotalDeliveries || 0,
          successfulDeliveries: overall.SuccessfulDeliveries || 0,
          failedDeliveries: overall.FailedDeliveries || 0,
          pendingDeliveries: overall.PendingDeliveries || 0,
          avgDeliveryTimeMs: Math.round(overall.AvgDeliveryTimeMs || 0),
          maxDeliveryTimeMs: overall.MaxDeliveryTimeMs || 0,
          successRate:
            overall.TotalDeliveries > 0
              ? (
                  (overall.SuccessfulDeliveries / overall.TotalDeliveries) *
                  100
                ).toFixed(2) + "%"
              : "0.00%",
        },
        byEventType: byEventType.map((e) => ({
          eventType: e.EVENTTYPE,
          totalEvents: e.TotalEvents,
          totalDeliveries: e.TotalDeliveries,
          successfulDeliveries: e.SuccessfulDeliveries,
          failedDeliveries: e.FailedDeliveries,
          avgDeliveryTimeMs: Math.round(e.AvgDeliveryTimeMs || 0),
          successRate:
            e.TotalDeliveries > 0
              ? ((e.SuccessfulDeliveries / e.TotalDeliveries) * 100).toFixed(
                  2,
                ) + "%"
              : "0.00%",
        })),
        bySubscriber: bySubscriber.map((s) => ({
          subscriberName: s.SUBSCRIBERNAME,
          totalDeliveries: s.TotalDeliveries || 0,
          successfulDeliveries: s.SuccessfulDeliveries || 0,
          failedDeliveries: s.FailedDeliveries || 0,
          avgDeliveryTimeMs: Math.round(s.AvgDeliveryTimeMs || 0),
          successRate: s.SuccessRate ? s.SuccessRate.toFixed(2) + "%" : "0.00%",
        })),
      },
    });
  } catch (error) {
    console.error("[MetricsController] Delivery stats error:", error);
    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to get delivery statistics",
      },
    });
  }
};

// API 9: GET /metrics/event-types
const getEventTypeDistribution = async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const eventTypes = await sequelize.query(
      `SELECT 
        EVENTTYPE,
        EVENTCATEGORY,
        COUNT(*) AS TotalEvents
       FROM EVENT_LOG
       WHERE PUBLISHEDAT >= :startDate
       GROUP BY EVENTTYPE, EVENTCATEGORY
       ORDER BY TotalEvents DESC`,
      {
        replacements: { startDate },
        type: QueryTypes.SELECT,
      },
    );

    const totalEvents = eventTypes.reduce((sum, e) => sum + e.TotalEvents, 0);

    return res.status(200).json({
      success: true,
      data: {
        period: `Last ${days} days`,
        eventTypes: eventTypes.map((e) => ({
          eventType: e.EVENTTYPE,
          eventCategory: e.EVENTCATEGORY,
          totalEvents: e.TotalEvents,
          percentage:
            totalEvents > 0
              ? ((e.TotalEvents / totalEvents) * 100).toFixed(2) + "%"
              : "0.00%",
        })),
        totalEvents,
      },
    });
  } catch (error) {
    console.error("[MetricsController] Event types error:", error);
    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to get event type distribution",
      },
    });
  }
};

// API 10: GET /metrics/health
const getServiceHealth = async (req, res) => {
  try {
    // Database health check
    let dbHealth = "UNHEALTHY";
    let dbLatency = null;

    const dbStart = Date.now();
    try {
      await sequelize.query("SELECT 1", { type: QueryTypes.SELECT });
      dbLatency = Date.now() - dbStart;
      dbHealth = "HEALTHY";
    } catch (error) {
      console.error("[Health] Database check failed:", error);
    }

    // Get pending deliveries count
    const pendingCount = await sequelize.query(
      `SELECT COUNT(*) AS PendingCount 
       FROM EVENT_DELIVERY 
       WHERE STATUS = 'PENDING'`,
      { type: QueryTypes.SELECT },
    );

    // Get today's events count
    const todayEvents = await sequelize.query(
      `SELECT COUNT(*) AS TodayCount 
       FROM EVENT_LOG 
       WHERE CAST(PUBLISHEDAT AS DATE) = CAST(GETDATE() AS DATE)`,
      { type: QueryTypes.SELECT },
    );

    // Get last 24 hours stats
    const last24Hours = await sequelize.query(
      `SELECT 
        COUNT(DISTINCT EL.EVENTID) AS EventsPublished,
        COUNT(ED.DELIVERYID) AS DeliveriesAttempted,
        SUM(CASE WHEN ED.STATUS = 'DELIVERED' THEN 1 ELSE 0 END) AS DeliveriesSuccessful,
        SUM(CASE WHEN ED.STATUS = 'FAILED' THEN 1 ELSE 0 END) AS DeliveriesFailed
       FROM EVENT_LOG EL
       LEFT JOIN EVENT_DELIVERY ED ON EL.EVENTID = ED.EVENTID
       WHERE EL.PUBLISHEDAT >= DATEADD(HOUR, -24, GETDATE())`,
      { type: QueryTypes.SELECT },
    );

    // Get unresolved dead letters
    const deadLetters = await sequelize.query(
      `SELECT COUNT(*) AS UnresolvedCount 
       FROM EVENT_DEAD_LETTER 
       WHERE RESOLVED = 0`,
      { type: QueryTypes.SELECT },
    );

    const stats = last24Hours[0];
    const successRate =
      stats.DeliveriesAttempted > 0
        ? (
            (stats.DeliveriesSuccessful / stats.DeliveriesAttempted) *
            100
          ).toFixed(2) + "%"
        : "0.00%";

    const overallHealth = dbHealth === "HEALTHY" ? "HEALTHY" : "DEGRADED";

    return res.status(200).json({
      success: true,
      data: {
        status: overallHealth,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        components: {
          database: {
            status: dbHealth,
            latencyMs: dbLatency,
          },
          deliveryProcessor: {
            status: "HEALTHY",
            pendingDeliveries: pendingCount[0].PendingCount,
          },
          eventPublisher: {
            status: "HEALTHY",
            eventsPublishedToday: todayEvents[0].TodayCount,
          },
        },
        metrics: {
          last24Hours: {
            eventsPublished: stats.EventsPublished,
            deliveriesAttempted: stats.DeliveriesAttempted,
            deliveriesSuccessful: stats.DeliveriesSuccessful,
            deliveriesFailed: stats.DeliveriesFailed,
            successRate,
          },
          deadLetterQueue: {
            unresolved: deadLetters[0].UnresolvedCount,
          },
        },
      },
    });
  } catch (error) {
    console.error("[MetricsController] Health check error:", error);
    return res.status(500).json({
      success: false,
      error: {
        code: "HEALTH_CHECK_FAILED",
        message: "Failed to perform health check",
      },
    });
  }
};

const aggregateMetrics = async (req, res) => {
  try {
    const { targetDate } = req.body; // Format: "2026-03-14"

    console.log(
      `[Metrics API] 📊 Aggregating metrics for: ${targetDate || "yesterday"}`,
    );

    const result = await sequelize.query(
      `EXEC USP_AGGREGATE_DAILY_METRICS @TARGETDATE = :targetDate`,
      {
        replacements: { targetDate: targetDate || null },
        type: QueryTypes.SELECT,
      },
    );

    const aggregationResult = result[0];

    if (aggregationResult.Status === "SUCCESS") {
      return res.status(200).json({
        success: true,
        data: {
          metricDate: aggregationResult.MetricDate,
          metricsCreated: aggregationResult.MetricsCreated,
          status: "SUCCESS",
        },
      });
    } else {
      return res.status(500).json({
        success: false,
        error: {
          code: "AGGREGATION_FAILED",
          message: aggregationResult.ErrorMessage,
        },
      });
    }
  } catch (error) {
    console.error("[Metrics API] Error:", error);
    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to aggregate metrics",
      },
    });
  }
};

/**
 * API: GET /metrics/daily
 * Get aggregated daily metrics
 */
const getDailyMetrics = async (req, res) => {
  try {
    const { startDate, endDate, eventType } = req.query;

    let query = `
      SELECT 
        METRICDATE,
        EVENTTYPE,
        SUBSCRIBERNAME,
        TOTALEVENTS,
        SUCCESSFULDELIVERIES,
        FAILEDDELIVERIES,
        AVGDURATIONMS,
        MAXDURATIONMS,
        CAST(SUCCESSFULDELIVERIES AS FLOAT) / 
          NULLIF(SUCCESSFULDELIVERIES + FAILEDDELIVERIES, 0) * 100 AS SUCCESSRATE
      FROM EVENT_METRICS
      WHERE 1=1
    `;

    const replacements = {};

    if (startDate) {
      query += ` AND METRICDATE >= :startDate`;
      replacements.startDate = startDate;
    }

    if (endDate) {
      query += ` AND METRICDATE <= :endDate`;
      replacements.endDate = endDate;
    }

    if (eventType) {
      query += ` AND EVENTTYPE = :eventType`;
      replacements.eventType = eventType;
    }

    query += ` ORDER BY METRICDATE DESC, EVENTTYPE, SUBSCRIBERNAME`;

    const metrics = await sequelize.query(query, {
      replacements,
      type: QueryTypes.SELECT,
    });

    return res.status(200).json({
      success: true,
      data: {
        metrics: metrics.map((m) => ({
          metricDate: m.METRICDATE,
          eventType: m.EVENTTYPE,
          subscriberName: m.SUBSCRIBERNAME,
          totalEvents: m.TOTALEVENTS,
          successfulDeliveries: m.SUCCESSFULDELIVERIES,
          failedDeliveries: m.FAILEDDELIVERIES,
          avgDurationMs: Math.round(m.AVGDURATIONMS || 0),
          maxDurationMs: m.MAXDURATIONMS,
          successRate: `${(m.SUCCESSRATE || 0).toFixed(2)}%`,
        })),
        total: metrics.length,
      },
    });
  } catch (error) {
    console.error("[Metrics API] Error:", error);
    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to get metrics",
      },
    });
  }
};

module.exports = {
  getDeliveryStats,
  getEventTypeDistribution,
  getServiceHealth,
  aggregateMetrics,
};
