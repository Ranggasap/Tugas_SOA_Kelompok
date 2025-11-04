const userService = require("../services/userService");

// Controller: tampilkan semua user
const getUserList = async (req, res) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.redirect("/login");
  }

  try {
    const userList = await userService.getAllUsers();
    res.render("user", { users: userList });
  } catch (error) {
    res.send("Error mengambil data user: " + error.message);
  }
};

// Controller: ubah role user
const changeUserRole = async (req, res) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).send("Akses ditolak");
  }

  const userId = req.params.id;
  const { newRole } = req.body;

  try {
    await userService.updateUserRole(userId, newRole);
    res.redirect("/user");
  } catch (error) {
    res.send("Gagal mengubah role: " + error.message);
  }
};

// Controller: hapus user
const deleteUser = async (req, res) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).send("Akses ditolak");
  }

  const userId = req.params.id;

  try {
    await userService.deleteUser(userId);
    res.redirect("/user");
  } catch (error) {
    res.send("Gagal menghapus user: " + error.message);
  }
};

module.exports = {
  getUserList,
  changeUserRole,
  deleteUser, // ✅ tambahkan ini agar bisa digunakan di routes
};
