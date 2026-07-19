const express = require("express");
const router = express.Router();
const {
  registerSubscription,
  listSubscriptions,
  toggleSubscription,
  deleteSubscription,
} = require("../controllers/subscription.controller");


router.post("/register" , registerSubscription);
router.get("/list", listSubscriptions);
router.put("/:subscriptionId/toggle", toggleSubscription);
router.delete("/:subscriptionId", deleteSubscription);

module.exports = router;
