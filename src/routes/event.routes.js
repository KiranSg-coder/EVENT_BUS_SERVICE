const express = require("express");
const router = express.Router();
const { publishEvent,
  getEventHistory,
  getEventById} = require("../controllers/event.controller")

router.post("/publish", publishEvent);
router.get("/history", getEventHistory);
router.get("/:eventId", getEventById);

module.exports = router;