const { createCheckoutSession } = require("../services/checkoutService");

exports.checkout = async (req, res) => {
  try {
    if (!req.session.user) return res.status(401).send("Silakan login dulu!");
    const token = await createCheckoutSession(req.session.user.uid);
    res.send(token);
  } catch (error) {
    console.error("Checkout error:", error);
    res.status(500).send(error.message || "Terjadi kesalahan saat checkout!");
  }
};
