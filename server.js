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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

  if (req.headers.accept && req.headers.accept.indexOf("application/json") !== -1) {
    return res.json({ cart });
  }

  res.render("cart", { cart });
});

app.post("/cart/update", async(req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  // console.log("Req cart: ", req)
  try {
    const userRecord = await admin.auth().getUserByEmail(req.session.user.email);
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
    const productIndex = cart.findIndex(item => item.idProduct === idProduct);

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
          const maxId = Math.max(...cart.map(item => item.idCart));
          newIdCart = maxId + 1;
        }
        cart.push({
          idCart: newIdCart,
          idProduct: idProduct,
          productName: productName,
          productPrice: Number(productPrice),
          productQty: quantity
        });
      }
    }

    await userRef.update({ cart });

    res.send("Cart updated successfully");
  } catch (error) {
    console.error("Error updating cart:", error);
    res.status(500).send("Error updating cart");
  }
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
