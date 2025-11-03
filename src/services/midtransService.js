const { admin, db } = require("../config/firestore");
const crypto = require("crypto");

async function handleMidtransNotification(notif) {
  const {
    order_id,
    status_code,
    gross_amount,
    signature_key,
    transaction_status,
    payment_type,
  } = notif;

  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  const computed = crypto
    .createHash("sha512")
    .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
    .digest("hex");

  if (computed !== signature_key) throw new Error("Invalid signature");

  const pendingRef = db.collection("pendingOrders").doc(order_id);
  const pendingSnap = await pendingRef.get();
  if (!pendingSnap.exists) return "Pending order not found";

  const pendingData = pendingSnap.data();
  const uid = pendingData.uid;
  const cart = pendingData.cart || [];

  const expectedAmount = cart.reduce(
    (sum, item) =>
      sum + Number(item.productPrice || 0) * Number(item.productQty || 1),
    0
  );

  if (Number(gross_amount) !== expectedAmount) {
    throw new Error(`Amount mismatch for ${order_id}`);
  }

  let status = "Pending";
  if (transaction_status === "settlement" || transaction_status === "capture") {
    status = "Done";
    await pendingRef.delete();
  } else if (["deny", "cancel", "expire"].includes(transaction_status)) {
    status = "Failed";
    await pendingRef.delete();
  }

  await db
    .collection("order")
    .doc(order_id)
    .set({
      orderId: order_id,
      userid: uid,
      idproduk: cart.map((i) => i.idProduct || i.idCart || ""),
      cart,
      total_harga: Number(gross_amount),
      payment: (payment_type || "").toUpperCase(),
      status,
      tanggal_pemesanan: admin.firestore.FieldValue.serverTimestamp(),
      rawNotification: notif,
    });

  // Bersihkan cart
  await db.collection("users").doc(uid).update({ cart: [] });
  return "OK";
}

module.exports = { handleMidtransNotification };
