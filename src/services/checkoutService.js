const { admin, db } = require("../config/firestore");
const snap = require("../config/midtrans");

async function createCheckoutSession(uid) {
  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists) throw new Error("User tidak ditemukan!");
  const userData = userDoc.data();

  if (!userData.cart || userData.cart.length === 0)
    throw new Error("Keranjang kosong!");

  const totalPrice = userData.cart.reduce(
    (sum, item) =>
      sum + Number(item.productPrice || 0) * Number(item.productQty || 1),
    0
  );

  const orderId = `ORDER-${uid}-${Date.now()}`;

  await db.collection("pendingOrders").doc(orderId).set({
    uid,
    cart: userData.cart,
    grossAmount: totalPrice,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const parameter = {
    transaction_details: {
      order_id: orderId,
      gross_amount: totalPrice,
    },
    customer_details: {
      first_name: userData.fullname,
      email: userData.email,
      phone: userData.phone,
      billing_address: {
        address: userData.address,
      },
    },
    item_details: userData.cart.map((item) => ({
      id: item.idProduct || String(Math.random()).slice(2),
      price: Number(item.productPrice || 0),
      quantity: Number(item.productQty || 1),
      name: item.productName || "Item",
    })),
  };

  const transaction = await snap.createTransaction(parameter);
  return transaction.token;
}

module.exports = { createCheckoutSession };
