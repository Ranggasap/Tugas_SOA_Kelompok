const admin = require("firebase-admin");
const db = admin.firestore();
const auth = admin.auth(); // 🔹 Tambahkan ini

// Ambil semua user dari Firestore
const getAllUsers = async () => {
  const snapshot = await db.collection("users").get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
};

// Ubah role user
const updateUserRole = async (userId, newRole) => {
  await db.collection("users").doc(userId).update({ role: newRole });
};

// Hapus user dari Firestore & Firebase Auth
const deleteUser = async (userId) => {
  // Hapus dari koleksi "users"
  await db.collection("users").doc(userId).delete();

  // Opsional: hapus dari Firebase Authentication
  try {
    await auth.deleteUser(userId);
    console.log(`✅ User ${userId} dihapus dari Firebase Auth`);
  } catch (err) {
    console.warn(`⚠️ User ${userId} tidak ditemukan di Auth atau sudah dihapus.`);
  }
};

module.exports = {
  getAllUsers,
  updateUserRole,
  deleteUser,
};
