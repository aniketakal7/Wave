const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/auth");
const { registerChatHandlers } = require("./sockets/chat");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend
app.use(express.static(path.join(__dirname, "../client")));

// API routes
app.use("/auth", authRoutes);

const server = http.createServer(app);
const io = new Server(server);

// Socket connection — delegate to chat handler
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);
  registerChatHandlers(io, socket);
});

// Start server on all network interfaces (0.0.0.0) so phones can connect
const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0";
server.listen(PORT, HOST, () => {
  const os = require("os");
  const nets = os.networkInterfaces();
  let localIP = "localhost";
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) { localIP = net.address; break; }
    }
  }
  console.log(`Server running on:`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${localIP}:${PORT}  ← use this on your phone`);
});