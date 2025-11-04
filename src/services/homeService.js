const { db } = require("../config/firestore");

class HomeService {
  // Get all products from Firestore
  async getAllProducts() {
    try {
      const snapshot = await db.collection("produk").get();
      const products = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        products.push({
          id: doc.id,
          name: doc.id,
          price: parseInt(data.Harga) || 0,
          description: data.Deskripsi || "Deskripsi tidak tersedia",
          image: data.Gambar || "https://via.placeholder.com/400x300?text=No+Image",
        });
      });

      console.log("Total products loaded:", products.length);
      return products;
    } catch (error) {
      console.error("Error fetching products from Firestore:", error);
      throw new Error("Gagal mengambil data produk dari database");
    }
  }

  // Get single product by ID
  async getProductById(productId) {
    try {
      const doc = await db.collection("produk").doc(productId).get();

      if (!doc.exists) {
        throw new Error("Produk tidak ditemukan");
      }

      const data = doc.data();
      return {
        id: doc.id,
        name: doc.id,
        price: parseInt(data.Harga) || 0,
        description: data.Deskripsi || "Deskripsi tidak tersedia",
        image: data.Gambar || "https://via.placeholder.com/400x300?text=No+Image",
      };
    } catch (error) {
      console.error("Error fetching product by ID:", error);
      throw error;
    }
  }

  // Search products by keyword
  async searchProducts(keyword) {
    try {
      const allProducts = await this.getAllProducts();
      
      if (!keyword || keyword.trim() === "") {
        return allProducts;
      }

      const lowerKeyword = keyword.toLowerCase().trim();
      return allProducts.filter(
        (product) =>
          product.name.toLowerCase().includes(lowerKeyword) ||
          product.description.toLowerCase().includes(lowerKeyword)
      );
    } catch (error) {
      console.error("Error searching products:", error);
      throw new Error("Gagal melakukan pencarian produk");
    }
  }
}

module.exports = new HomeService();