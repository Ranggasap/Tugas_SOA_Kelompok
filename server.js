require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");
const path = require("path");
const session = require("express-session");

// init firebase admin
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});

const db = admin.firestore();

// start payments session testing
const midtransClient = require("midtrans-client");
// end payments session testing

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

app.get("/whoami", (req, res) => {
  if (req.session.user.uid) {
    return res.json({
      userId: req.session.user.uid,
      userEmail: req.session.userEmail,
      cookie: req.headers.cookie,
    });
  }
  res.json({ message: "Belum login", cookie: req.headers.cookie });
});

// end payments session testing

app.use(bodyParser.urlencoded({ extended: true }));

// start payments session testing
app.use(express.json());
// end payments session testing

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

// route default -> login
app.get("/", (req, res) => {
  res.render("login");
});

// login page
app.get("/login", (req, res) => {
  res.render("login");
});

// register page
app.get("/register", (req, res) => {
  res.render("register");
});

// handle register
app.post("/register", async (req, res) => {
  const { fullname, email, address, phone, password, confirmPassword } =
    req.body;

  if (password !== confirmPassword) {
    return res.send("Password dan Konfirmasi Password tidak sama!");
  }

  try {
    const user = await admin.auth().createUser({
      email,
      password,
    });

    // simpan user ke firestore
    await db.collection("users").doc(user.uid).set({
      fullname,
      email,
      address,
      phone,
      role: "user",
      createdAt: new Date(),
    });

    console.log("User saved to Firestore with UID:", user.uid);
    res.redirect("/login");
  } catch (error) {
    res.send("Error: " + error.message);
  }
});

// handle login (sederhana untuk sementara)
app.post("/login", async (req, res) => {
  const { email } = req.body;

  // cek apakah email ada di firestore
  try {
    // cari user berdasarkan email
    const userRecord = await admin.auth().getUserByEmail(email);

    // ambil data user di firestore
    const userDoc = await db.collection("users").doc(userRecord.uid).get();

    if (!userDoc.exists) {
      return res.send("User tidak ditemukan di database!");
    }

    // simpan session
    req.session.user = {
      uid: userRecord.uid,
      email: userRecord.email,
    };

    res.redirect("/home");
  } catch (error) {
    console.error("Login Error: ", error);
    res.send("Login Gagal: " + error.message);
  }
});

// handle logout
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
    }
    res.redirect("/login");
  });
});

// start payments session testing
function isAuthenticated(req, res, next) {
  if (req.session.user && req.session.user.uid) {
    return next();
  }
  res.redirect("/login");
}

// end payments session testing

// home page
app.get(
  "/home",
  /*start payments session testing*/ isAuthenticated,
  /*end payments session testing*/ (req, res) => {
    console.log("🏠 GET /home userId:", req.session.user.uid);
    res.render("home", { user: req.session.user });
  }
);

// profile page
app.get("/profile", async (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const uid = req.session.user.uid;
  const userDoc = await db.collection("users").doc(uid).get();

  if (!userDoc.exists) {
    return res.send("Data user tidak ditemukan!");
  }

  res.render("profile", { user: userDoc.data() });
});

// payment page
app.get("/payments", isAuthenticated, async (req, res) => {
  const userDoc = await db.collection("users").doc(req.session.user.uid).get();
  const userData = userDoc.data();

  res.render("payments", { user: userData });
});

// start checkout route
app.post("/checkout", isAuthenticated, async (req, res) => {
  try {
    // ambil data user dari Firestore pakai session
    const userDoc = await db
      .collection("users")
      .doc(req.session.user.uid)
      .get();
    const userData = userDoc.data();

    if (!userData.cart || userData.cart.length === 0) {
      return res.send("Keranjang kosong!");
    }

    // hitung total harga — gunakan per-item (price * qty)
    const totalPrice = userData.cart.reduce(
      (sum, item) =>
        sum + Number(item.productPrice || 0) * Number(item.productQty || 1),
      0
    );

    // Generate orderId supaya bisa mapping di pendingOrders
    const orderId = "ORDER-" + req.session.user.uid + "-" + Date.now();

    // Simpan pending order dulu (berguna saat notifikasi datang)
    await db.collection("pendingOrders").doc(orderId).set({
      uid: req.session.user.uid,
      cart: userData.cart,
      grossAmount: totalPrice,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // buat transaksi ke Midtrans Snap
    let snap = new midtransClient.Snap({
      isProduction: false, // kalau sudah live ganti true
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
    /*try {
      await db.collection("users").doc(uid).update({ cart: [] });
      console.log("🧹 Cart cleared for user:", uid);
    } catch (e) {
      console.warn("⚠️ Gagal membersihkan cart untuk user:", uid, e.message);
    }*/

    res.status(200).send("OK");
  } catch (error) {
    console.error("Midtrans Notification Error:", error);
    return res.status(500).send("Error");
  }
});
// end Midtrans notification handler

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
