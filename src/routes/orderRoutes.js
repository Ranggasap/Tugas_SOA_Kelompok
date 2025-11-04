// src/routes/orderRoutes.js
const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");

router.post("/order/status/:id", orderController.updateOrderStatus);

module.exports = router;
