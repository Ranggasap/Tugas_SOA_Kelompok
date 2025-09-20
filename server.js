require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");
const path = require("path");
const session = require("express-session");

// Setup Firebase Admin dengan menggunakan kredensial yang diunduh
const serviceAccount = require(path.join(__dirname, 'config', 'florist-app-70c3d-firebase-adminsdk-fbsvc-4b0eaf340b.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'florist-app-70c3d.appspot.com', 
});

const db = admin.firestore();

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

// Setup session
app.use(
  session({
    secret: "secret-key",
    resave: false,
    saveUninitialized: false,
  })
);

// Route default -> login
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
  const { fullname, email, phone, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return res.send("Password dan Konfirmasi Password tidak sama!");
  }

  try {
    const user = await admin.auth().createUser({
      email,
      password,
    });

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

// handle login
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

// handle logout
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
    }
    res.redirect("/login");
  });
});

// home page for user
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

// home page for admin
app.get("/home_admin", async (req, res) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.redirect("/login");
  }

  try {
    // Ambil data admin (user yang login)
    const uid = req.session.user.uid;
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) return res.send("Data user tidak ditemukan!");

    const userData = userDoc.data();

    // Ambil semua produk
    const produkSnapshot = await db.collection("produk").get();
    const produkList = produkSnapshot.docs.map((doc) => doc.data());

    // Ambil semua order
    const orderSnapshot = await db.collection("order").get();
    const ordersList = [];

    for (const doc of orderSnapshot.docs) {
      const orderData = doc.data();
      const userId = orderData.userid;

      // Ambil nama user
      let userFullName = "User tidak ditemukan";
      if (userId) {
        const userDoc = await db.collection("users").doc(userId).get();
        if (userDoc.exists) {
          userFullName = userDoc.data().fullname;
        }
      }

      // Ambil produk dan quantity
      let products = [];
      if (Array.isArray(orderData.cart)) {
        for (const item of orderData.cart) {
          const productName = item.productName || "Produk Tidak Dikenal";
          const quantity = item.quantity || 1;

          products.push({
            name: productName,
            quantity: quantity,
          });
        }
      }

      ordersList.push({
        id: doc.id, // <--- Tambahkan ini
        ...orderData,
        orderId: orderData.orderId || doc.id,
        userFullName,
        total_harga: orderData.total_harga || 0,
        status: orderData.status || "Belum Dibuat",
        products: products,
      });      
    }

    res.render("home_admin", {
      user: userData,
      produk: produkList,
      orders: ordersList,
    });

  } catch (error) {
    res.send("Error mengambil data: " + error.message);
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

  res.render("profile", { user: userDoc.data() });
});

// Menambah produk dengan menggunakan nama_produk sebagai ID dokumen
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




// Produk CRUD routes - Menampilkan daftar produk
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
        nama_produk: doc.id, // karena nama produk kamu jadi ID dokumen
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


// Tampilkan form tambah produk
app.get("/produk/create", (req, res) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.redirect("/login");
  }

  res.render("create_produk"); // pastikan ada file views/create_produk.ejs
});

// Route untuk menampilkan formulir edit produk
app.get("/produk/edit/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // Ambil data produk berdasarkan ID dari Firestore
    const productDoc = await db.collection("produk").doc(id).get();
    if (!productDoc.exists) {
      return res.send("Produk tidak ditemukan!");
    }

    // Kirim data produk ke halaman edit_produk
    res.render("edit_produk", { product: productDoc.data(), id });
  } catch (error) {
    res.send("Error mengambil data produk: " + error.message);
  }
});

// Route untuk memproses pembaruan produk
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


// Delete Produk routes
app.get("/produk/delete/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // Menghapus produk berdasarkan ID dari Firestore
    await db.collection("produk").doc(id).delete();
    res.redirect("/produk");  // Redirect setelah berhasil menghapus produk
  } catch (error) {
    res.send("Error menghapus produk: " + error.message);
  }
});

// Order CRUD routes
app.get("/order", async (req, res) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.redirect("/login"); // hanya admin
  }

  try {
    const orderSnapshot = await db.collection("order").get();
    const orders = [];

    for (const doc of orderSnapshot.docs) {
      const orderData = doc.data();
      const userId = orderData.userid;

      // Ambil nama user
      let userFullName = "User tidak ditemukan";
      if (userId) {
        const userDoc = await db.collection("users").doc(userId).get();
        if (userDoc.exists) {
          userFullName = userDoc.data().fullname;
        }
      }

      // Ambil nama produk dari cart
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
        uid: orderData.userid || "Tidak diketahui", // ✅ Tambahkan UID
        userFullName,
        total_harga: orderData.total_harga,
        status: orderData.status || "Belum Dibuat",
        productNames,
        ...orderData,
      });      
    }

    // Kirim ke view
    res.render("order", { orders });
  } catch (error) {
    console.error("Error mengambil data order:", error);
    res.send("Error mengambil data order: " + error.message);
  }
});






// Route untuk mengubah status order
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



app.get("/user", async (req, res) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.redirect("/login"); // hanya admin yang boleh akses
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


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
