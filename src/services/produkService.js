// services/produk_Service.js
const admin = require("firebase-admin");
const db = admin.firestore();


//Mengambil Semua data produk
async function getAllProduk() {
  const produkSnapshot = await db.collection("produk").get();
  return produkSnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      nama_produk: doc.id,
      deskripsi: data.Deskripsi || "",
      price: data.Harga || 0,
      image: data.Gambar || "",
    };
  });
}

async function getProdukById(id) {
  const docRef = db.collection("produk").doc(id);
  const docSnap = await docRef.get();
  if (!docSnap.exists) return null;
  return docSnap.data();
}

//Menambah Produk
async function addProduk({ nama_produk, Deskripsi, Harga, Gambar }) {
  await db.collection("produk").doc(nama_produk).set({
    nama_produk,
    Deskripsi,
    Harga: parseFloat(Harga),
    Gambar,
    createdAt: new Date(),
  });
}

//Update Produk
async function updateProduk(id, { Deskripsi, Harga, Gambar }) {
  await db.collection("produk").doc(id).update({
    Deskripsi,
    Harga: parseFloat(Harga),
    Gambar,
  });
}

//Delete Produk
async function deleteProduk(id) {
  await db.collection("produk").doc(id).delete();
}

module.exports = {
  getAllProduk,
  getProdukById,
  addProduk,
  updateProduk,
  deleteProduk,
};
