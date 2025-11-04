const { db } = require("../config/firestore");
const admin = require("firebase-admin");

exports.updateOrderStatus = async (req, res) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.redirect("/login");
  }

  const { id } = req.params;
  const { status } = req.body;

  try {
    const allowedStatus = ["Belum Diproses", "Sedang Diproses", "Siap Diambil", "Selesai"];
    if (!allowedStatus.includes(status)) {
      return res.status(400).send("Status tidak valid.");
    }

    const orderRef = db.collection("order").doc(id);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return res.status(404).send("Pesanan tidak ditemukan.");
    }

    await orderRef.update({
      status,
      updatedAt: admin.firestore.Timestamp.now(),
    });

    console.log(`✅ Order ${id} diubah menjadi: ${status}`);
    res.redirect("/home_admin");
  } catch (error) {
    console.error("❌ Gagal mengubah status order:", error);
    res.status(500).send("Gagal mengubah status order: " + error.message);
  }
};
