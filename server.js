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
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});

const db = admin.firestore();

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

// setup session
app.use(
  session({
    secret: "secret-key",
    resave: false,
    saveUninitialized: false,
  })
);

// route default -> login
app.get("/", (req, res) => {
  res.redirect("/login");
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
  const { fullname, email, phone, password, confirmPassword } =
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

    if (!userDoc.exists){
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


// home page
app.get("/home", async (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
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

  res.render("profile", { user: userDoc.data()});
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// Cart Page
app.get("/cart", async (req, res) => {
  const phone = req.query.phone;
  if (!phone) {
    return res.send("Phone parameter required");
  }
  const usersRef = db.collection("users");
  const snapshot = await usersRef.where("phone", "==", phone).get();
  if (snapshot.empty) {
    console.log("User not found");
    return res.send("User not found");
  }
  const userData = snapshot.docs[0].data();
  console.log("User Data: ", userData);
  const cart = userData.cart || [];
  console.log("Cart: ", cart);
  res.render("cart", { cart });
});

app.post("/cart/update", async(req, res) => {
  const {phone, index, quantity} = req.body
})

// History Page
app.get("/history", async (req, res) => {
  const userId = req.query.userId;
  if (!userId) {
    return res.send("UserId parameter required");
  }
  try {
    const ordersRef = db.collection("order");
    const snapshot = await ordersRef.where("userid", "==", userId).get();
    if (snapshot.empty) {
      console.log("No orders found");
      return res.send("No orders found");
    }
    const orders = snapshot.docs.map(doc => doc.data());
    console.log("Orders Data:", orders);
    res.render("history", { orders });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.send("Error fetching orders");
  }
})
