// controllers/cartController.js
const { admin, db } = require("../config/firestore");

exports.getCartPage = async (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  try {
    const email = req.session.user.email;
    const usersRef = db.collection("users");
    const snapshot = await usersRef.where("email", "==", email).get();

    if (snapshot.empty) {
      console.log("User not found");
      return res.send("User not found");
    }

    const userData = snapshot.docs[0].data();
    let cart = userData.cart || [];

    // ==== AMBIL GAMBAR FIRESTORE PRODUK BERDASARKAN idProduct ====
    for (let item of cart) {
      if (item.idProduct) {
        const produkRef = db.collection("produk").doc(item.idProduct);
        const produkDoc = await produkRef.get();
        if (produkDoc.exists) {
          const produkData = produkDoc.data();
          item.image = produkData.image || produkData.Gambar || null;  // otomatis ambil field yang ada
        }
      }
    }
    // =============================================================

    if (
      req.headers.accept &&
      req.headers.accept.indexOf("application/json") !== -1
    ) {
      return res.json({ cart });
    }

    res.render("cart", { cart });
  } catch (err) {
    console.error("Error loading cart:", err);
    res.status(500).send("Internal Server Error");
  }
};


exports.updateCart = async (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  try {
    const userRecord = await admin.auth().getUserByEmail(req.session.user.email);
    if (!userRecord) return res.status(404).send("User not found");

    const userRef = db.collection("users").doc(userRecord.uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).send("User data not found");

    const { idProduct, productName, productPrice, qty } = req.body;
    let quantity = parseInt(qty);
    if (isNaN(quantity)) quantity = 0;

    let cart = userDoc.data().cart || [];
    const productIndex = cart.findIndex((item) => item.idProduct === idProduct);

    if (productIndex !== -1) {
      cart[productIndex].productQty += quantity;
      if (cart[productIndex].productQty <= 0) cart.splice(productIndex, 1);
    } else if (quantity > 0) {
      let newIdCart = cart.length > 0 ? Math.max(...cart.map((item) => item.idCart)) + 1 : 1;
      cart.push({
        idCart: newIdCart,
        idProduct: idProduct,
        productName: productName,
        productPrice: Number(productPrice),
        productQty: quantity,
      });
    }

    await userRef.update({ cart });
    res.send("Cart updated successfully");
  } catch (error) {
    console.error("Error updating cart:", error);
    res.status(500).send("Error updating cart");
  }
};
