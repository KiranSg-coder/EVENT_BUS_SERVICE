// jobs/processDeliveries.js
const cron = require('node-cron');
const deliveryService = require('../services/deliveryService');

// Run every minute
cron.schedule('* * * * *', async () => {
  const currentTime = new Date().toISOString();
  
  try {
    console.log(`[DeliveryJob] 🔄 Running at ${currentTime}`);
    
    const result = await deliveryService.processPendingDeliveries();
    
    if (result.processed > 0) {
      console.log(`[DeliveryJob] 📊 Processed: ${result.processed}, ✅ Success: ${result.successful}, ❌ Failed: ${result.failed}`);
    }
    
  } catch (error) {
    console.error('[DeliveryJob] ❌ Error:', error.message);
  }
});

console.log('[DeliveryJob] ⏰ Scheduled - runs every minute');