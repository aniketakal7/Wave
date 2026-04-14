const { randomUUID } = require("crypto");

// In-memory user store
const users = new Map(); // id → user object
const emailIndex = new Map(); // email → id

function create({ name, email, hashedPassword }) {
  const id = randomUUID();
  const user = {
    id,
    name,
    email: email.toLowerCase().trim(),
    password: hashedPassword,
    refreshTokens: new Set(),
    createdAt: new Date().toISOString(),
  };
  users.set(id, user);
  emailIndex.set(user.email, id);

  // Return safe copy (without password & refreshTokens)
  const { password: _, refreshTokens: __, ...safeUser } = user;
  return safeUser;
}

function findByEmail(email) {
  const id = emailIndex.get(email.toLowerCase().trim());
  return id ? users.get(id) || null : null;
}

function findById(id) {
  return users.get(id) || null;
}

function addRefreshToken(userId, tokenHash) {
  const user = users.get(userId);
  if (user) user.refreshTokens.add(tokenHash);
}

function hasRefreshToken(userId, tokenHash) {
  const user = users.get(userId);
  return user ? user.refreshTokens.has(tokenHash) : false;
}

function removeRefreshToken(userId, tokenHash) {
  const user = users.get(userId);
  if (user) user.refreshTokens.delete(tokenHash);
}

function removeAllRefreshTokens(userId) {
  const user = users.get(userId);
  if (user) user.refreshTokens.clear();
}

module.exports = {
  create,
  findByEmail,
  findById,
  addRefreshToken,
  hasRefreshToken,
  removeRefreshToken,
  removeAllRefreshTokens,
};
