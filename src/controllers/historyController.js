const { db } = require("../config/firestore");

exports.getHistoryPage = async (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  try {
    const userId = req.session.user.uid;
    const ordersSnap = await db
      .collection("order")
      .where("userid", "==", userId)
      .get();

    if (ordersSnap.empty) {
      return res.render("history", { orders: [] });
    }

    let orders = ordersSnap.docs.map((doc) => doc.data());
    orders.sort((a, b) => {
      const dateA = a.tanggal_pemesanan?.toDate
        ? a.tanggal_pemesanan.toDate()
        : a.tanggal_pemesanan;
      const dateB = b.tanggal_pemesanan?.toDate
        ? b.tanggal_pemesanan.toDate()
        : b.tanggal_pemesanan;
      return new Date(dateB) - new Date(dateA);
    });

    res.render("history", { orders });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.send("Error fetching orders");
  }
};