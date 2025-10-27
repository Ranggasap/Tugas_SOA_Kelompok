const authService = require("../services/authService");

// Login Routes user and admin
exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const userData = await authService.loginUser(email, password);
    req.session.user = {
      uid: userData.uid,
      email: userData.email,
      role: userData.role,
    };
    res.redirect(userData.role === "admin" ? "/home_admin" : "/home");
  } catch (error) {
    res.render("login", { error: "Email atau password salah!" });
  }
};

exports.getLoginPage = (req, res) => {
  if (req.session.user) {
    return res.redirect(req.session.user.role === "admin" ? "/home_admin" : "/home");
  }
  res.render("login", { error: null });
};

// Register
exports.getRegisterPage = (req, res) => {
  res.render("register", { error: null });
};

exports.register = async (req, res) => {
  try {
    await authService.registerUser(req.body);
    res.redirect("/login");
  } catch (error) {
    res.render("register", { error: error.message });
  }
};

// Logout
exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error("Error destroying session:", err);
    res.redirect("/login");
  });
};
