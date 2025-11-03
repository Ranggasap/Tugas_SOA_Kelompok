const { handleMidtransNotification } = require("../services/midtransService");

exports.notificationHandler = async (req, res) => {
  try {
    const result = await handleMidtransNotification(req.body);
    res.status(200).send(result);
  } catch (err) {
    console.error("Midtrans notification error:", err);
    res.status(500).send(err.message || "Internal server error");
  }
};
