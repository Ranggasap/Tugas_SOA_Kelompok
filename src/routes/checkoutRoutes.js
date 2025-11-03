const express = require("express");
const router = express.Router();
const { checkout } = require("../controllers/checkoutController");

// POST /checkout → membuat transaksi baru dan mengembalikan token Midtrans
router.post("/checkout", checkout);

module.exports = router;
