/**
 * Simple in-memory rate limiter.
 * @param {{ windowMs: number, max: number, message?: string }} opts
 */
function rateLimit({ windowMs = 60000, max = 100, message } = {}) {
  const hits = new Map(); // ip → { count, resetTime }

  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || "unknown";
    const now = Date.now();
    let entry = hits.get(ip);

    if (!entry || now > entry.resetTime) {
      entry = { count: 0, resetTime: now + windowMs };
      hits.set(ip, entry);
    }

    entry.count++;

    if (entry.count > max) {
      return res.status(429).json({
        success: false,
        message: message || "Too many requests. Please try again later.",
      });
    }

    next();
  };
}

module.exports = { rateLimit };
