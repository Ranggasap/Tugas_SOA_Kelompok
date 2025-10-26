const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

router.get("/login", authController.getLoginPage);
router.post("/login", authController.login);
router.get("/register", authController.getRegisterPage);
router.post("/register", authController.register);
router.get("/logout", authController.logout);

module.exports = router;
