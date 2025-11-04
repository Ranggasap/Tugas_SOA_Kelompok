// controllers/produk_Controller.js
const {
    getAllProduk,
    getProdukById,
    addProduk,
    updateProduk,
    deleteProduk,
  } = require("../services/produkService");

  //Harus Role admin dahulu baru bisa semuanya
  
  async function renderAllProduk(req, res) {
    if (!req.session.user || req.session.user.role !== "admin") {
      return res.redirect("/login");
    }
  
    try {
      const produkList = await getAllProduk();
      res.render("produk", { produk: produkList });
    } catch (error) {
      res.send("Error mengambil data produk: " + error.message);
    }
  }
  
  async function renderCreateForm(req, res) {
    if (!req.session.user || req.session.user.role !== "admin") {
      return res.redirect("/login");
    }
    res.render("create_produk");
  }
  
  async function renderEditForm(req, res) {
    const { id } = req.params;
    try {
      const product = await getProdukById(id);
      if (!product) return res.send("Produk tidak ditemukan!");
      res.render("edit_produk", { product, id });
    } catch (error) {
      res.send("Error mengambil data produk: " + error.message);
    }
  }
  
  async function createProduk(req, res) {
    const { nama_produk, Deskripsi, Harga, Gambar } = req.body;
  
    try {
      await addProduk({ nama_produk, Deskripsi, Harga, Gambar });
      res.redirect("/produk");
    } catch (error) {
      res.send("Error menambah produk: " + error.message);
    }
  }
  
  async function updateProdukById(req, res) {
    const { id } = req.params;
    const { Deskripsi, Harga, Gambar } = req.body;
  
    try {
      await updateProduk(id, { Deskripsi, Harga, Gambar });
      res.redirect("/produk");
    } catch (error) {
      res.send("Error mengedit produk: " + error.message);
    }
  }
  
  async function deleteProdukById(req, res) {
    const { id } = req.params;
  
    try {
      await deleteProduk(id);
      res.redirect("/produk");
    } catch (error) {
      res.send("Error menghapus produk: " + error.message);
    }
  }
  
  module.exports = {
    renderAllProduk,
    renderCreateForm,
    renderEditForm,
    createProduk,
    updateProdukById,
    deleteProdukById,
  };
  