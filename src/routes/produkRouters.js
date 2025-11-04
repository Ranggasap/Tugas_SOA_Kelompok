// routes/produk_Routers.js
const express = require("express");
const router = express.Router();
const {
  renderAllProduk,
  renderCreateForm,
  renderEditForm,
  createProduk,
  updateProdukById,
  deleteProdukById,
} = require("../controllers/produkController");

// CRUD Routes
router.get("/produk", renderAllProduk);
router.get("/produk/create", renderCreateForm);
router.post("/produk", createProduk);
router.get("/produk/edit/:id", renderEditForm);
router.post("/produk/edit/:id", updateProdukById);
router.get("/produk/delete/:id", deleteProdukById);

module.exports = router;
