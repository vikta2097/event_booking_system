const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

let io = null;

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined");
}

/**
 * Initialize Socket.IO (ONLY ONCE)
 */
const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: [
        "http://localhost:3000",
        "https://eventhyper.netlify.app",
      ],
      credentials: true,
    },
  });

  // AUTH MIDDLEWARE
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(" ")[1];

      if (!token) return next(new Error("No token"));

      const decoded = jwt.verify(token, JWT_SECRET);

      socket.user = {
        id: decoded.id,
        role: decoded.role,
      };

      next();
    } catch (err) {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const { id, role } = socket.user;

    socket.join(`user_${id}`);
    socket.join(role);

    console.log(`🔌 Socket connected: ${socket.id} (${id})`);

    socket.emit("connected", { userId: id, role });

    socket.on("disconnect", () => {
      console.log(`❌ Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

/**
 * Singleton getter
 */
const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO not initialized. Call initSocket(server) first.");
  }
  return io;
};

module.exports = {
  initSocket,
  getIO,
};