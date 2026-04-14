const express = require("express");
const bcrypt = require("bcryptjs");

const userStore = require("../models/userStore");
const {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  authenticateToken,
} = require("../middleware/jwt");
const { validateSignup, validateLogin, validateRefresh } = require("../middleware/validate");
const { rateLimit } = require("../middleware/rateLimit");

const router = express.Router();
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || "12", 10);

// ─── POST /auth/signup ─────────────────────────────────────────────────────────
router.post(
  "/signup",
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: "Too many signup attempts. Try again in 15 minutes." }),
  validateSignup,
  async (req, res) => {
    try {
      const { name, email, password } = req.body;

      // Check for existing user
      if (userStore.findByEmail(email)) {
        // Use same response time as success to prevent user enumeration
        await bcrypt.hash(password, BCRYPT_ROUNDS); // timing equalizer
        return res.status(409).json({ success: false, message: "An account with that email already exists." });
      }

      const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const user = userStore.create({ name: name.trim(), email, hashedPassword });

      // Issue tokens on signup so user is immediately logged in
      const accessToken = generateAccessToken({ id: user.id, email: user.email, name: user.name });
      const { token: refreshToken, tokenHash } = generateRefreshToken();
      userStore.addRefreshToken(user.id, tokenHash);

      return res.status(201).json({
        success: true,
        message: "Account created successfully.",
        user,
        accessToken,
        refreshToken,
      });
    } catch (err) {
      console.error("Signup error:", err);
      return res.status(500).json({ success: false, message: "Internal server error." });
    }
  }
);

// ─── POST /auth/login ──────────────────────────────────────────────────────────
router.post(
  "/login",
  rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: "Too many login attempts. Try again in 15 minutes." }),
  validateLogin,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      const user = userStore.findByEmail(email);

      // Always run bcrypt to prevent timing attacks (even if user not found)
      const hashToCompare = user ? user.password : "$2a$12$invalidhashfortimingprotection000000000000000000000000";
      const isMatch = await bcrypt.compare(password, hashToCompare);

      if (!user || !isMatch) {
        return res.status(401).json({ success: false, message: "Invalid email or password." });
      }

      const { password: _, refreshTokens: __, ...safeUser } = user;
      const accessToken = generateAccessToken({ id: user.id, email: user.email, name: user.name });
      const { token: refreshToken, tokenHash } = generateRefreshToken();
      userStore.addRefreshToken(user.id, tokenHash);

      return res.status(200).json({
        success: true,
        message: "Logged in successfully.",
        user: safeUser,
        accessToken,
        refreshToken,
      });
    } catch (err) {
      console.error("Login error:", err);
      return res.status(500).json({ success: false, message: "Internal server error." });
    }
  }
);

// ─── POST /auth/refresh ────────────────────────────────────────────────────────
router.post(
  "/refresh",
  rateLimit({ windowMs: 15 * 60 * 1000, max: 30 }),
  validateRefresh,
  async (req, res) => {
    try {
      const { refreshToken, userId } = req.body;

      if (!userId) {
        return res.status(400).json({ success: false, message: "userId is required." });
      }

      const tokenHash = hashRefreshToken(refreshToken);
      const hasToken = userStore.hasRefreshToken(userId, tokenHash);

      if (!hasToken) {
        return res.status(401).json({ success: false, message: "Invalid or expired refresh token." });
      }

      const user = userStore.findById(userId);
      if (!user) {
        return res.status(401).json({ success: false, message: "User not found." });
      }

      // Rotate refresh token (invalidate old, issue new)
      userStore.removeRefreshToken(userId, tokenHash);
      const { token: newRefreshToken, tokenHash: newTokenHash } = generateRefreshToken();
      userStore.addRefreshToken(userId, newTokenHash);

      const accessToken = generateAccessToken({ id: user.id, email: user.email, name: user.name });

      return res.status(200).json({
        success: true,
        accessToken,
        refreshToken: newRefreshToken,
      });
    } catch (err) {
      console.error("Refresh error:", err);
      return res.status(500).json({ success: false, message: "Internal server error." });
    }
  }
);

// ─── POST /auth/logout ─────────────────────────────────────────────────────────
router.post("/logout", authenticateToken, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const tokenHash = hashRefreshToken(refreshToken);
      userStore.removeRefreshToken(req.user.id, tokenHash);
    }
    return res.status(200).json({ success: true, message: "Logged out successfully." });
  } catch (err) {
    console.error("Logout error:", err);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
});

// ─── POST /auth/logout-all ─────────────────────────────────────────────────────
router.post("/logout-all", authenticateToken, async (req, res) => {
  try {
    userStore.removeAllRefreshTokens(req.user.id);
    return res.status(200).json({ success: true, message: "Logged out from all devices." });
  } catch (err) {
    console.error("Logout-all error:", err);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
});

module.exports = router;