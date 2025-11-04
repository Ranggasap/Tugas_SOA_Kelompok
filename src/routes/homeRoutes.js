const express = require("express");
const router = express.Router();
const homeController = require("../controllers/homeController");

// Middleware to check if user is logged in
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  res.redirect("/login");
};

// Page Routes - GUNAKAN SALAH SATU:
// Jika PAKAI authentication:
router.get("/", isAuthenticated, homeController.getHomePage.bind(homeController));
router.get("/home", isAuthenticated, homeController.getHomePage.bind(homeController));

// Jika TANPA authentication (comment yang atas, uncomment yang bawah):
// router.get("/", homeController.getHomePage.bind(homeController));
// router.get("/home", homeController.getHomePage.bind(homeController));

// API Routes for AJAX calls
router.get("/api/products", homeController.getProductsAPI.bind(homeController));
router.get("/api/products/search", homeController.searchProductsAPI.bind(homeController));
router.get("/api/products/:id", homeController.getProductByIdAPI.bind(homeController));

module.exports = router;