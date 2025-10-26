const axios = require("axios");
const { admin, db } = require("../firebase/firestore");

exports.registerUser = async (data) => {
  try {
    const { fullname, email, phone, password, confirmPassword } = data;

    if (password !== confirmPassword) {
      throw new Error("Password dan konfirmasi password tidak sama!");
    }

    const user = await admin.auth().createUser({ email, password });

    await db.collection("users").doc(user.uid).set({
      fullname,
      email,
      phone,
      role: "user",
      createdAt: new Date(),
    });

    return user;
  } catch (error) {
    throw new Error(error.message);
  }
};

exports.loginUser = async (email, password) => {
  const response = await axios.post(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_WEB_API_KEY}`,
    { email, password, returnSecureToken: true }
  );

  const firebaseUid = response.data.localId;
  const userDoc = await db.collection("users").doc(firebaseUid).get();

  if (!userDoc.exists) throw new Error("User tidak ditemukan di database!");

  return { uid: firebaseUid, ...userDoc.data() };
};
