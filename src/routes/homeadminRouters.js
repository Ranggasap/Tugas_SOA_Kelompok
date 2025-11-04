const express = require("express");
const router = express.Router();
const homeAdminController = require("../controllers/homeadminController");


router.get("/home_admin", homeAdminController.getHomeAdmin);

module.exports = router;
