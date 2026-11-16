require("./config/loadEnv"); // Phase 1: APP_ENV-aware .env loader (LOCAL_/PROD_ blocks)
const express = require("express");
const cors = require("cors");
const app = express();
// S12: never send raw internal/SQL error text to clients outside development.
app.use(require("./middleware/safeErrorResponses"));
const sequelizeConnection = require("./config/database");

const corsOrigin =
  process.env.CORS_ORIGIN === "*"
    ? true
    : (process.env.CORS_ORIGIN || "http://localhost:5173")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
app.use(cors({ origin: corsOrigin, credentials: true }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const eventRoutes = require("./routes/event.routes");
const metricsRoutes  = require("./routes/metrics.routes");
const subscriptionRoutes  = require("./routes/subscription.routes");
const adminRoutes = require("./routes/admin.routes");

app.get("/", (req, res) => {
  res.send("sEvent server is running....");
});

// Phase 1 (R8): the event bus is service-to-service only. Every publisher and subscriber already
// sends X-Service-Key; without this guard anyone reaching this port could publish fake events,
// subscribe to every user's events or replay dead letters. Fail closed (503 when the key is unset).
const requireServiceKey = require("./middleware/requireServiceKey");
app.use("/event", requireServiceKey, eventRoutes);
app.use("/metrics", requireServiceKey, metricsRoutes);
app.use("/subscription", requireServiceKey, subscriptionRoutes);
app.use("/admin", requireServiceKey, adminRoutes);

require('./jobs/processDeliveries');      // Process event deliveries
require('./jobs/aggregateMetrics'); 

sequelizeConnection
  .authenticate()
  .then(() => {
    console.log("Database connection is established successfully");
    return sequelizeConnection.sync();
  })
  .then(() => {
    const PORT = process.env.PORT || 6007;
    app.listen(PORT, () => {
      console.log(`sever is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.log("Error occured while syncing database.", err);
  });

module.exports = app;
