const express = require("express");
const router = express.Router();
const {getDeliveryStats,
  getEventTypeDistribution,
  getServiceHealth, aggregateMetrics} = require("../controllers/metrics.controller");


router.get("/delivery-stats", getDeliveryStats);
router.get("/event-types", getEventTypeDistribution)
router.get("/health",getServiceHealth )
router.post("/aggregate", aggregateMetrics)
module.exports = router