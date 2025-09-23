require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");
const path = require("path");
const session = require("express-session");
const midtransClient = require("midtrans-client");

// Init Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});

const db = admin.firestore();

const app = express();

// start payments session testing

app.set("trust proxy", true); // jangan pakai 1, biar auto deteksi dari ngrok

app.use(
  session({
    secret: process.env.SESSION_SECRET || "my-secret-key",
    resave: false,
    saveUninitialized: false,
    proxy: true, // penting kalau pakai ngrok atau proxy
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 1000 * 60 * 60,
    },
  })
);

// end payments session testing
app.use(bodyParser.urlencoded({ extended: true }));

// start payments session testing
app.use(express.json());

// end payments session testing
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session setup with cookie options
app.use(
  session({
    secret: process.env.SESSION_SECRET || "my-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 1000 * 60 * 60,
    },
  })
);

app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// Route default -> login
app.get("/", (req, res) => {
  if (req.session.user) {
    return res.render(req.session.user.role === "admin" ? "/home_admin" : "home");
  }
  res.render("login");
});

// Login page
app.get("/login", (req, res) => {
  if (req.session.user) {
    return res.redirect(req.session.user.role === "admin" ? "/home_admin" : "/home");
  }
  res.render("login");
});

// Register page
app.get("/register", (req, res) => {
  res.render("register");
});

// Handle register
app.post("/register", async (req, res) => {
  const { fullname, email, phone, password, confirmPassword } =
    req.body;

  if (password !== confirmPassword) {
    return res.send("Password dan Konfirmasi Password tidak sama!");
  }

  try {
    const user = await admin.auth().createUser({ email, password });

    // Simpan user ke Firestore
    await db.collection("users").doc(user.uid).set({
      fullname,
      email,
      phone,
      role: "user", // default role for new user
      createdAt: new Date(),
    });

    console.log("User saved to Firestore with UID:", user.uid);
    res.redirect("/login");
  } catch (error) {
    res.send("Error: " + error.message);
  }
});

// Handle login
app.post("/login", async (req, res) => {
  const { email } = req.body;

  try {
    // Cari user berdasarkan email
    const userRecord = await admin.auth().getUserByEmail(email);

    // Ambil data user di firestore
    const userDoc = await db.collection("users").doc(userRecord.uid).get();
    if (!userDoc.exists)  {
      return res.send("User tidak ditemukan di database!");
    }

    // Simpan session
    req.session.user = {
      uid: userRecord.uid,
      email: userRecord.email,
      role: userDoc.data().role, // tambahkan role ke session
    };

    // Cek role user dan arahkan ke halaman yang sesuai
    if (userDoc.data().role === "admin") {
      res.redirect("/home_admin"); // untuk admin
    } else {
      res.redirect("/home"); // untuk user biasa
    }
  } catch (error) {
    console.error("Login Error: ", error);
    res.send("Login Gagal: " + error.message);
  }
  });

// Handle logout
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
    }
    res.redirect("/login");
  });
});


// home page
app.get("/home", async (req, res) => {
  if (!req.session.user || req.session.user.role !== "user") {
    return res.redirect("/login"); // jika bukan user, arahkan ke login
  }

  try {
    const uid = req.session.user.uid;
    const userDoc = await db.collection("users").doc(uid).get();

    if(!userDoc.exists) {
      return res.send("Data user tidak ditemukan!");
    }

    const userData = userDoc.data();

    res.render("home", { user: userData});
  }catch(error){
    res.send("Error ambil data user: " + error.message);
  }
});

// Home page for admin
app.get("/home_admin", async (req, res) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.redirect("/login");
  }

  try {
    const uid = req.session.user.uid;
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) return res.send("Data user tidak ditemukan!");

    const userData = userDoc.data();

    // Get all products
    const produkSnapshot = await db.collection("produk").get();
    const produkList = produkSnapshot.docs.map((doc) => doc.data());

    // Get all orders
    const orderSnapshot = await db.collection("order").get();
    const ordersList = await Promise.all(orderSnapshot.docs.map(async (doc) => {
      const orderData = doc.data();
      const userId = orderData.userid;

      let userFullName = "User tidak ditemukan";
      if (userId) {
        const userDoc = await db.collection("users").doc(userId).get();
        if (userDoc.exists) {
          userFullName = userDoc.data().fullname;
        }
      }

      let products = [];
      if (Array.isArray(orderData.cart)) {
        for (const item of orderData.cart) {
          const productName = item.productName || "Produk Tidak Dikenal";
          const quantity = item.quantity || 1;
          products.push({ name: productName, quantity });
        }
      }

      return {
        id: doc.id,
        ...orderData,
        orderId: orderData.orderId || doc.id,
        userFullName,
        total_harga: orderData.total_harga || 0,
        status: orderData.status || "Belum Dibuat",
        products: products,
      };
    }));

    res.render("home_admin", { user: userData, produk: produkList, orders: ordersList });
  } catch (error) {
    res.send("Error mengambil data: " + error.message);
  }
});

// Profile page
app.get("/profile", async (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const uid = req.session.user.uid;
  const userDoc = await db.collection("users").doc(uid).get();

  if (!userDoc.exists) {
    return res.send("Data user tidak ditemukan!");
  }

  res.render("profile", { user: userDoc.data()  });
});

app.get("/detail/:id", (req, res) => {
  const products = [
    {
      id: "1",
      name: "Bunga Mawar",
      description: "Mawar merah segar",
      price: 50000,
      image: "https://via.placeholder.com/400",
    },
    {
      id: "2",
      name: "Bunga Tulip",
      description: "Tulip indah warna-warni",
      price: 70000,
      image: "https://via.placeholder.com/400",
    },
  ];

  const product = products.find((p) => p.id === req.params.id);

  if (product) {
    res.render("detail", { product });
  } else {
    res.status(404).send("Produk tidak ditemukan");
  }
});

// Cart Page
app.get("/cart", async (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  const email = req.session.user.email;
  const usersRef = db.collection("users");
  const snapshot = await usersRef.where("email", "==", email).get();
  if (snapshot.empty) {
    console.log("User not found");
    return res.send("User not found");
  }
  const userData = snapshot.docs[0].data();
  console.log("User Data: ", userData);
  const cart = userData.cart || [];

  if (
    req.headers.accept &&
    req.headers.accept.indexOf("application/json") !== -1
  ) {
    return res.json({ cart });
  }

  res.render("cart", { cart });
});

app.post("/cart/update", async (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  // console.log("Req cart: ", req)
  try {
    const userRecord = await admin
      .auth()
      .getUserByEmail(req.session.user.email);
    if (!userRecord) {
      return res.status(404).send("User not found");
    }
    const userRef = db.collection("users").doc(userRecord.uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return res.status(404).send("User data not found");
    }

    const { idProduct, productName, productPrice, qty } = req.body;
    // console.log("idProduct: ", idProduct )
    let quantity = parseInt(qty);
    if (isNaN(quantity)) quantity = 0;

    let cart = userDoc.data().cart || [];

    // Check if product exists in cart
    const productIndex = cart.findIndex((item) => item.idProduct === idProduct);

    if (productIndex !== -1) {
      // Product exists, update quantity
      cart[productIndex].productQty += quantity;

      // Remove product if qty <= 0
      if (cart[productIndex].productQty <= 0) {
        cart.splice(productIndex, 1);
      }
    } else {
      // Product does not exist, add new if qty > 0
      if (quantity > 0) {
        let newIdCart = 1;
        if (cart.length > 0) {
          const maxId = Math.max(...cart.map((item) => item.idCart));
          newIdCart = maxId + 1;
        }
        cart.push({
          idCart: newIdCart,
          idProduct: idProduct,
          productName: productName,
          productPrice: Number(productPrice),
          productQty: quantity,
        });
      }
    }

    await userRef.update({ cart });

    res.send("Cart updated successfully");
  } catch (error) {
    console.error("Error updating cart:", error);
    res.status(500).send("Error updating cart");
  }
});

// History Page
app.get("/history", async (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  try {
    const userId = req.session.user.uid; // ambil dari session
    const ordersSnap = await db
      .collection("order")
      .where("userid", "==", userId)
      .get();

    if (ordersSnap.empty) {
      return res.render("history", { orders: [] });
    }

    let orders = ordersSnap.docs.map((doc) => doc.data());
    orders.sort((a, b) => {
      const dateA = a.tanggal_pemesanan?.toDate ? a.tanggal_pemesanan.toDate() : a.tanggal_pemesanan;
      const dateB = b.tanggal_pemesanan?.toDate ? b.tanggal_pemesanan.toDate() : b.tanggal_pemesanan;
      return new Date(dateB) - new Date(dateA);
    });
    res.render("history", { orders });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.send("Error fetching orders");
  }
});

// payment page
app.get("/payments", async (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const userDoc = await db.collection("users").doc(req.session.user.uid).get();
  if (!userDoc.exists) {
    return res.send("Data user tidak ditemukan!");
  }

  const userData = userDoc.data();
  res.render("payments", { user: userData });
});

// start checkout route
app.post("/checkout", async (req, res) => {
  if (!req.session.user) {
    return res.status(401).send("Silakan login dulu!");
  }

  try {
    const userDoc = await db
      .collection("users")
      .doc(req.session.user.uid)
      .get();
    if (!userDoc.exists) {
      return res.status(404).send("User tidak ditemukan!");
    }

    const userData = userDoc.data();

    if (!userData.cart || userData.cart.length === 0) {
      return res.send("Keranjang kosong!");
    }

    // hitung total harga
    const totalPrice = userData.cart.reduce(
      (sum, item) =>
        sum + Number(item.productPrice || 0) * Number(item.productQty || 1),
      0
    );

    const orderId = "ORDER-" + req.session.user.uid + "-" + Date.now();

    await db.collection("pendingOrders").doc(orderId).set({
      uid: req.session.user.uid,
      cart: userData.cart,
      grossAmount: totalPrice,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    let snap = new midtransClient.Snap({
      isProduction: false,
      serverKey: process.env.MIDTRANS_SERVER_KEY,
      clientKey: process.env.MIDTRANS_CLIENT_KEY,
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
        id: item.idProduct || item.idCart || String(Math.random()).slice(2),
        price: Number(item.productPrice || 0),
        quantity: Number(item.productQty || 1),
        name: item.productName || "Item",
      })),
    };

    const transaction = await snap.createTransaction(parameter);
    res.send(transaction.token);
  } catch (error) {
    console.error("Checkout Error:", error);
    res.status(500).send("Terjadi kesalahan saat checkout!");
  }
});

// Add product with the product name as the document ID
app.post("/produk", async (req, res) => {
  const { nama_produk, Deskripsi, Harga, Gambar } = req.body;

  try {
    await db.collection("produk").doc(nama_produk).set({
      nama_produk,
      Deskripsi,
      Harga: parseFloat(Harga),
      Gambar,
      createdAt: new Date(),
    });
    res.redirect("/produk");
  } catch (error) {
    res.send("Error menambah produk: " + error.message);
  }
});

// CRUD routes for products
app.get("/produk", async (req, res) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.redirect("/login");
  }

  try {
    const produkSnapshot = await db.collection("produk").get();
    const produkList = produkSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        nama_produk: doc.id,
        deskripsi: data.Deskripsi || "",
        price: data.Harga || 0,
        image: data.Gambar || "",
      };
    });

    res.render("produk", { produk: produkList });
  } catch (error) {
    res.send("Error mengambil data produk: " + error.message);
  }
});

// Show form to create a new product
app.get("/produk/create", (req, res) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.redirect("/login");
  }
  res.render("create_produk");
});

// Show form to edit product
app.get("/produk/edit/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const productDoc = await db.collection("produk").doc(id).get();
    if (!productDoc.exists) {
      return res.send("Produk tidak ditemukan!");
    }

    res.render("edit_produk", { product: productDoc.data(), id });
  } catch (error) {
    res.send("Error mengambil data produk: " + error.message);
  }
});

// Update product route
app.post("/produk/edit/:id", async (req, res) => {
  const { id } = req.params;
  const { Deskripsi, Harga, Gambar } = req.body;

  try {
    await db.collection("produk").doc(id).update({
      Deskripsi,
      Harga: parseFloat(Harga),
      Gambar,
    });

    res.redirect("/produk");
  } catch (error) {
    res.send("Error mengedit produk: " + error.message);
  }
});

// Delete product route
app.get("/produk/delete/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await db.collection("produk").doc(id).delete();
    res.redirect("/produk");
  } catch (error) {
    res.send("Error menghapus produk: " + error.message);
  }
});

// Order CRUD routes
app.get("/order", async (req, res) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.redirect("/login");
  }

  try {
    const orderSnapshot = await db.collection("order").get();
    const orders = [];

    for (const doc of orderSnapshot.docs) {
      const orderData = doc.data();
      const userId = orderData.userid;

      let userFullName = "User tidak ditemukan";
      if (userId) {
        const userDoc = await db.collection("users").doc(userId).get();
        if (userDoc.exists) {
          userFullName = userDoc.data().fullname;
        }
      }

      let productNames = [];
      if (Array.isArray(orderData.cart)) {
        for (const item of orderData.cart) {
          let productName = item.productName;
          try {
            const productDoc = await db.collection("produk").doc(productName).get();
            if (productDoc.exists) {
              productNames.push(productDoc.data().nama_produk);
            } else {
              productNames.push("Produk tidak ditemukan");
            }
          } catch (err) {
            productNames.push("Gagal ambil produk");
          }
        }
      }

      orders.push({
        id: doc.id,
        orderId: orderData.orderId || doc.id,
        uid: orderData.userid || "Tidak diketahui",
        userFullName,
        total_harga: orderData.total_harga,
        status: orderData.status || "Belum Dibuat",
        productNames,
        ...orderData,
      });
    }

    res.render("order", { orders });
  } catch (error) {
    console.error("Error mengambil data order:", error);
    res.send("Error mengambil data order: " + error.message);
  }
});

// Update order status
app.post("/order/status/:id", async (req, res) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.redirect("/login");
  }

  const { id } = req.params;
  const { status } = req.body;

  try {
    await db.collection("order").doc(id).update({ status });
    res.redirect("/home_admin");
  } catch (error) {
    res.send("Gagal mengubah status order: " + error.message);
  }
});

// User data management for admin
app.get("/user", async (req, res) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.redirect("/login");
  }

  try {
    const usersSnapshot = await db.collection("users").get();
    const userList = usersSnapshot.docs.map((doc) => {
      return { id: doc.id, ...doc.data() };
    });

    res.render("user", { users: userList });
  } catch (error) {
    res.send("Error mengambil data user: " + error.message);
  }
});

// end checkout route

// Midtrans notification handler
const crypto = require("crypto");
app.post("/midtrans-notification", async (req, res) => {
  try {
    // gunakan body yang sudah di-parse oleh app.use(express.json())
    const notif = req.body;
    console.log("📩 Midtrans notification received:", notif);

    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      payment_type,
    } = notif;

    // verify signature
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    const input = `${order_id}${status_code}${gross_amount}${serverKey}`;
    const computed = crypto.createHash("sha512").update(input).digest("hex");

    if (computed !== signature_key) {
      console.warn(
        "❌ Invalid signature for order",
        order_id,
        "computed:",
        computed,
        "received:",
        signature_key
      );
      return res.status(400).send("Invalid signature");
    }

    console.log("✅ Signature verified for order:", order_id);

    // ambil pendingOrder yg sebelumnya kita simpan saat checkout
    const pendingRef = db.collection("pendingOrders").doc(order_id);
    const pendingSnap = await pendingRef.get();
    if (!pendingSnap.exists) {
      console.warn("⚠️ pendingOrder tidak ditemukan for", order_id);
      // Balas OK supaya Midtrans tidak retry terus; atau log untuk investigasi.
      return res.status(200).send("OK");
    }

    const pendingData = pendingSnap.data();
    const uid = pendingData.uid;
    const cart = pendingData.cart || [];

    // 🔹 Tambahkan verifikasi gross_amount disini
    const expectedAmount = cart.reduce(
      (sum, item) =>
        sum + Number(item.productPrice || 0) * Number(item.productQty || 1),
      0
    );

    if (Number(gross_amount) !== expectedAmount) {
      console.warn(
        `⚠️ Gross amount mismatch! Order: ${order_id}, expected: ${expectedAmount}, received: ${gross_amount}`
      );
      return res.status(400).send("Amount mismatch");
    }

    // Tentukan status final
    let status = "Pending";
    if (
      transaction_status === "settlement" ||
      transaction_status === "capture"
    ) {
      status = "Done";
      // Hapus pending order hanya jika status final
      await pendingRef.delete();
    } else if (
      transaction_status === "deny" ||
      transaction_status === "cancel" ||
      transaction_status === "expire"
    ) {
      status = "Failed";
      await pendingRef.delete();
      // Opsional: hapus pending Order juga kalau transaksi gagal
    }
    // Simpan order ke Firestore collection "order"
    const orderRef = db.collection("order").doc(order_id);
    await orderRef.set({
      orderId: order_id,
      userid: uid,
      idproduk: cart.map((i) => i.idProduct || i.idCart || ""),
      cart: cart,
      total_harga: Number(gross_amount),
      payment: (payment_type || "").toUpperCase(),
      status,
      tanggal_pemesanan: admin.firestore.FieldValue.serverTimestamp(),
      rawNotification: notif,
    });

    console.log("🎉 Order updated to Firestore:", order_id);

    // Bersihkan cart user (opsional)
    try {
      await db.collection("users").doc(uid).update({ cart: [] });
      console.log("🧹 Cart cleared for user:", uid);
    } catch (e) {
      console.warn("⚠️ Gagal membersihkan cart untuk user:", uid, e.message);
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Midtrans Notification Error:", error);
    return res.status(500).send("Error");
  }
});
// end Midtrans notification handler

// Final server initialization
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
