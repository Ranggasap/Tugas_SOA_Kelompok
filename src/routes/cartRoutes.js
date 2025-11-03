const express = require("express");
const router = express.Router();
const cartController = require("../controllers/cartController");

router.get("/", cartController.getCartPage);
router.post("/update", cartController.updateCart);

module.exports = router;