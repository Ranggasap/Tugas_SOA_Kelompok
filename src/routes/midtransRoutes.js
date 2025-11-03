// routes/midtransRoutes.js
const express = require("express");
const router = express.Router();
const { notificationHandler } = require("../controllers/midtransController");

router.post("/midtrans-notification", notificationHandler);

module.exports = router;
