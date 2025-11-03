const homeService = require("../services/homeService");
const { db } = require("../config/firestore");

class HomeController {
  // Render home page
  async getHomePage(req, res) {
    // Check if user is logged in and is a "user" role
    if (!req.session.user || req.session.user.role !== "user") {
      return res.redirect("/login");
    }

    try {
      // Get user data from Firestore
      const uid = req.session.user.uid;
      const userDoc = await db.collection("users").doc(uid).get();

      if (!userDoc.exists) {
        return res.status(404).send("Data user tidak ditemukan!");
      }

      const userData = userDoc.data();
      
      // Get cart count from session
      const cartCount = req.session.cart ? req.session.cart.length : 0;
      
      // Render view
      res.render("home", {
        title: "Igun Florist - Home",
        cartCount: cartCount,
        user: req.session.user,
        userData: userData
      });
    } catch (error) {
      console.error("Error rendering home page:", error);
      res.status(500).send("Error ambil data: " + error.message);
    }
  }

  // API: Get all products (JSON)
  async getProductsAPI(req, res) {
    try {
      const products = await homeService.getAllProducts();
      res.json({
        success: true,
        data: products,
      });
    } catch (error) {
      console.error("Error fetching products API:", error);
      res.status(500).json({
        success: false,
        message: "Gagal mengambil data produk",
      });
    }
  }

  // API: Get single product by ID (JSON)
  async getProductByIdAPI(req, res) {
    try {
      const { id } = req.params;
      const product = await homeService.getProductById(id);
      
      res.json({
        success: true,
        data: product,
      });
    } catch (error) {
      console.error("Error fetching product by ID:", error);
      res.status(404).json({
        success: false,
        message: error.message || "Produk tidak ditemukan",
      });
    }
  }

  // API: Search products (JSON)
  async searchProductsAPI(req, res) {
    try {
      const { keyword } = req.query;
      const products = await homeService.searchProducts(keyword);
      
      res.json({
        success: true,
        data: products,
        count: products.length,
      });
    } catch (error) {
      console.error("Error searching products:", error);
      res.status(500).json({
        success: false,
        message: "Gagal melakukan pencarian",
      });
    }
  }
}

module.exports = new HomeController();