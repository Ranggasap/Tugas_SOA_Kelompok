require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const session = require("express-session");
const midtransClient = require("midtrans-client");
const { admin, db } = require("./src/config/firestore");

const app = express();

app.set("trust proxy", true);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "my-secret-key",
    resave: false,
    saveUninitialized: false,
    proxy: true, // penting untuk ngrok / railway
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 1000 * 60 * 60,
    },
  })
);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "src/views"));
app.use(express.static(path.join(__dirname, "src/public")));

const authRoutes = require("./src/routes/authRoutes");
app.use("/", authRoutes);

const historyRoutes = require("./src/routes/historyRoutes");
app.use("/history", historyRoutes);

const cartRoutes = require("./src/routes/cartRoutes");
app.use("/cart", cartRoutes);

const midtransRoutes = require("./src/routes/midtransRoutes");
app.use("/", midtransRoutes);

const checkoutRoutes = require("./src/routes/checkoutRoutes");
app.use("/", checkoutRoutes);

const homeRoutes = require("./src/routes/homeRoutes");
app.use("/", homeRoutes); //home

// Redirect default ke halaman login
app.get("/", (req, res) => {
  return res.redirect("/login");
});

// home page
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
    const ordersList = await Promise.all(
      orderSnapshot.docs.map(async (doc) => {
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
      })
    );

    res.render("home_admin", {
      user: userData,
      produk: produkList,
      orders: ordersList,
    });
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

// Add product with the product name as the document ID
app.post("/produk", async (req, res) => {
  const { nama_produk, Deskripsi, Harga, Gambar } = req.body;

  try {
    await db
      .collection("produk")
      .doc(nama_produk)
      .set({
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
    await db
      .collection("produk")
      .doc(id)
      .update({
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
            const productDoc = await db
              .collection("produk")
              .doc(productName)
              .get();
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
