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


// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBgSh39-LZUjqwisirJNPF1EIMcRvp_F48",
  authDomain: "florist-app-70c3d.firebaseapp.com",
  projectId: "florist-app-70c3d",
  storageBucket: "florist-app-70c3d.firebasestorage.app",
  messagingSenderId: "692096916407",
  appId: "1:692096916407:web:d6a76e5fa2d6c699e2e632"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

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

app.get("/detail/:id", (req, res) => {
  const products = [
    { id: "1", name: "Bunga Mawar", description: "Mawar merah segar", price: 50000, image: "https://via.placeholder.com/400" },
    { id: "2", name: "Bunga Tulip", description: "Tulip indah warna-warni", price: 70000, image: "https://via.placeholder.com/400" }
  ];

  const product = products.find(p => p.id === req.params.id);

  if (product) {
    res.render("detail", { product });
  } else {
    res.status(404).send("Produk tidak ditemukan");
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
