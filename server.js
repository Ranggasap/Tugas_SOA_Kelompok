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
    return res.redirect(req.session.user.role === "admin" ? "/home_admin" : "/home");
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
  const { fullname, email, phone, password, confirmPassword } = req.body;

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

    if (!userDoc.exists) {
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

// Home page for user
app.get("/home", async (req, res) => {
  if (!req.session.user || req.session.user.role !== "user") {
    return res.redirect("/login"); // jika bukan user, arahkan ke login
  }

  try {
    const uid = req.session.user.uid;
    const userDoc = await db.collection("users").doc(uid).get();

    if (!userDoc.exists) {
      return res.send("Data user tidak ditemukan!");
    }

    const userData = userDoc.data();
    res.render("home", { user: userData });
  } catch (error) {
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

  res.render("profile", { user: userDoc.data() });
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

// Final server initialization
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
