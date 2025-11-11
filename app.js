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

const homeRoutes = require('./src/routes/homeRoutes');
app.use('/', homeRoutes);

const historyRoutes = require("./src/routes/historyRoutes");
app.use("/history", historyRoutes);

const cartRoutes = require("./src/routes/cartRoutes");
app.use("/cart", cartRoutes);

const midtransRoutes = require("./src/routes/midtransRoutes");
app.use("/", midtransRoutes);

const checkoutRoutes = require("./src/routes/checkoutRoutes");
app.use("/", checkoutRoutes);

//Bagian Dashboard Admin
const homeAdminRouter = require("./src/routes/homeadminRouters");
app.use("/", homeAdminRouter);

const addProdukRouter = require("./src/routes/produkRouters");
app.use("/", addProdukRouter);

const userRouter = require("./src/routes/userRoutes");
app.use("/user", userRouter);

const orderRoutes = require("./src/routes/orderRoutes");
app.use("/", orderRoutes);

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


// Final server initialization
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});