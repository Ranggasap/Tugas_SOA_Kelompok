// src/services/homeadminService.js
const admin = require("firebase-admin");
const db = admin.firestore();

exports.getHomeAdminData = async (uid) => {
  // Ambil data user admin
  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists) throw new Error("Data user tidak ditemukan!");
  const userData = userDoc.data();

  // Ambil semua produk
  const produkSnapshot = await db.collection("produk").get();
  const produkList = produkSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // Ambil semua order (urutan terbaru)
  const orderSnapshot = await db
    .collection("order")
    .orderBy("tanggal_pemesanan", "desc")
    .get();

  const ordersList = await Promise.all(
    orderSnapshot.docs.map(async (doc) => {
      const orderData = doc.data();
      const userId = orderData.userid;

      // Ambil nama user
      let userFullName = "User tidak ditemukan";
      if (userId) {
        const userDoc = await db.collection("users").doc(userId).get();
        if (userDoc.exists) {
          userFullName = userDoc.data().fullname;
        }
      }

      // Ambil produk di cart
      const products = Array.isArray(orderData.cart)
        ? orderData.cart.map((item) => ({
            name: item.productName || "Produk Tidak Dikenal",
            quantity: item.quantity || 1,
          }))
        : [];

      return {
        id: doc.id,
        ...orderData,
        orderId: orderData.orderId || doc.id,
        userFullName,
        total_harga: orderData.total_harga || 0,
        status: orderData.status || "Belum Dibuat",
        tanggal_pemesanan: orderData.tanggal_pemesanan || null,
        products,
      };
    })
  );

  return { userData, produkList, ordersList };
};
