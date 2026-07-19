// jobs/aggregateMetrics.js
const cron = require('node-cron');
const { QueryTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Aggregate daily metrics
 * Runs every day at 12:05 AM (5 minutes after midnight)
 * Aggregates yesterday's data
 */
cron.schedule('5 0 * * *', async () => {
  console.log('[Metrics] 📊 Starting daily metrics aggregation...');
  
  try {
    const result = await sequelize.query(
      `EXEC USP_AGGREGATE_DAILY_METRICS`,
      { type: QueryTypes.SELECT }
    );
    
    const aggregationResult = result[0];
    
    if (aggregationResult.Status === 'SUCCESS') {
      console.log(`[Metrics] ✅ Aggregation complete`);
      console.log(`[Metrics] 📅 Date: ${aggregationResult.MetricDate}`);
      console.log(`[Metrics] 📈 Metrics created: ${aggregationResult.MetricsCreated}`);
    } else {
      console.error(`[Metrics] ❌ Aggregation failed:`, aggregationResult);
    }
    
  } catch (error) {
    console.error('[Metrics] ❌ Error during aggregation:', error);
  }
});

console.log('[Metrics] ⏰ Daily aggregation job scheduled (runs at 12:05 AM)');

module.exports = {};