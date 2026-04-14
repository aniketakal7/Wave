function validateSignup(req, res, next) {
  const { name, email, password } = req.body || {};

  const errors = [];
  if (!name || typeof name !== "string" || name.trim().length < 2) {
    errors.push("Name must be at least 2 characters.");
  }
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    errors.push("A valid email is required.");
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    errors.push("Password must be at least 6 characters.");
  }

  if (errors.length) {
    return res.status(400).json({ success: false, message: errors.join(" ") });
  }
  next();
}

function validateLogin(req, res, next) {
  const { email, password } = req.body || {};

  const errors = [];
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    errors.push("A valid email is required.");
  }
  if (!password || typeof password !== "string") {
    errors.push("Password is required.");
  }

  if (errors.length) {
    return res.status(400).json({ success: false, message: errors.join(" ") });
  }
  next();
}

function validateRefresh(req, res, next) {
  const { refreshToken, userId } = req.body || {};

  if (!refreshToken || typeof refreshToken !== "string") {
    return res.status(400).json({ success: false, message: "Refresh token is required." });
  }
  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ success: false, message: "User ID is required." });
  }
  next();
}

module.exports = { validateSignup, validateLogin, validateRefresh };
