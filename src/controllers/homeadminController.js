const { db } = require("../config/firestore");

exports.getHomeAdmin = async (req, res) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.redirect("/login");
  }

  try {
    // 🔹 Ambil semua order dari koleksi "order"
    const snapshot = await db.collection("order").get();

    const orders = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data();

        // 🔹 Ambil data user
        let userFullName = "User tidak ditemukan";
        if (data.userid) {
          const userDoc = await db.collection("users").doc(data.userid).get();
          if (userDoc.exists) {
            userFullName = userDoc.data().fullname || "User";
          }
        }

        // 🔹 Ambil produk dari field cart
        let products = [];
        if (Array.isArray(data.cart)) {
          products = data.cart.map((item) => ({
            name: item.productName || "Produk Tidak Dikenal",
            quantity: item.productQty || 1,
            price: item.productPrice || 0,
          }));
        }

        // 🔹 Mapping status “Done” → “Belum Diproses” (case-insensitive)
        const rawStatus = data.status ? data.status.toLowerCase() : "";
        let mappedStatus = "Belum Diproses";
        if (rawStatus === "sedang diproses") mappedStatus = "Sedang Diproses";
        else if (rawStatus === "siap diambil") mappedStatus = "Siap Diambil";
        else if (rawStatus === "selesai") mappedStatus = "Selesai";
        // jika status = "done", otomatis akan tetap jadi "Belum Diproses"

        return {
          id: doc.id,
          orderId: data.orderId || doc.id,
          userFullName,
          products,
          total_harga: data.total_harga || 0,
          tanggal_pemesanan: data.tanggal_pemesanan || null,
          status: mappedStatus,
          payment: data.payment || "-",
        };
      })
    );

    // 🔹 Urutkan berdasarkan tanggal_pemesanan (terbaru di atas)
    orders.sort((a, b) => {
      const dateA = a.tanggal_pemesanan?._seconds ? a.tanggal_pemesanan._seconds : 0;
      const dateB = b.tanggal_pemesanan?._seconds ? b.tanggal_pemesanan._seconds : 0;
      return dateB - dateA; // DESC → terbaru di atas
    });

    // 🔹 Filter berdasarkan status
    const belumDiproses = orders.filter((o) => o.status === "Belum Diproses");
    const sedangDiproses = orders.filter((o) => o.status === "Sedang Diproses");
    const siapDiambil = orders.filter((o) => o.status === "Siap Diambil");
    const selesai = orders.filter((o) => o.status === "Selesai");

    // 🔹 Ambil data produk (untuk statistik dashboard)
    const produkSnapshot = await db.collection("produk").get();
    const produk = produkSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // 🔹 Render ke halaman
    res.render("home_admin", {
      user: req.session.user,
      produk,
      orders,
      belumDiproses,
      sedangDiproses,
      siapDiambil,
      selesai,
    });
  } catch (error) {
    console.error("❌ Gagal memuat data:", error);
    res.status(500).send("Gagal memuat data: " + error.message);
  }
};
