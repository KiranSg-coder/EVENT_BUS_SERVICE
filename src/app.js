require('dotenv').config();
const express = require("express");
const app = express();
const sequelizeConnection = require("./config/database");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const eventRoutes = require("./routes/event.routes");
const metricsRoutes  = require("./routes/metrics.routes");
const subscriptionRoutes  = require("./routes/subscription.routes");
const adminRoutes = require("./routes/admin.routes");

app.get("/", (req, res) => {
  res.send("sEvent server is running....");
});

app.use("/event", eventRoutes);
app.use("/metrics", metricsRoutes)
app.use("/subscription", subscriptionRoutes )
app.use("/admin", adminRoutes)

require('./jobs/processDeliveries');      // Process event deliveries
require('./jobs/aggregateMetrics'); 

sequelizeConnection
  .authenticate()
  .then(() => {
    console.log("Database connection is established successfully");
    return sequelizeConnection.sync();
  })
  .then(() => {
    const PORT = 6006;
    app.listen(PORT, () => {
      console.log(`sever is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.log("Error occured while syncing database.", err);
  });

module.exports = app;
