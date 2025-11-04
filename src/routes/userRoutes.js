const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");

// Tampilkan semua user
router.get("/", userController.getUserList);

// Ubah role user
router.post("/:id/role", userController.changeUserRole);

// Hapus user
router.post("/:id/delete", userController.deleteUser);

module.exports = router;
