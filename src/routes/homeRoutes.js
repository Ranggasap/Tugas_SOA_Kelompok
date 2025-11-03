const express = require("express");
const router = express.Router();
const homeController = require("../controllers/homeController");

// Middleware to check if user is logged in
const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  res.redirect("/login");
};

// Page Routes
router.get("/", isAuthenticated, homeController.getHomePage.bind(homeController));
router.get("/home", isAuthenticated, homeController.getHomePage.bind(homeController));

// API Routes for AJAX calls
router.get("/api/products", isAuthenticated, homeController.getProductsAPI.bind(homeController));
router.get("/api/products/search", isAuthenticated, homeController.searchProductsAPI.bind(homeController));
router.get("/api/products/:id", isAuthenticated, homeController.getProductByIdAPI.bind(homeController));

module.exports = router;