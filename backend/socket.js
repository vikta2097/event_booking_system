const jwt = require("jsonwebtoken");

let io = null;

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined");
}

const initSocket = (serverIO) => {
  io = serverIO;

  // 🔐 AUTH MIDDLEWARE
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
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.user.id;
    const role = socket.user.role;

    // auto secure rooms
    socket.join(`user_${userId}`);
    socket.join(role);

    console.log(`🔌 Auth socket: ${socket.id} (${userId})`);

    socket.emit("connected", {
      userId,
      role,
    });

    socket.on("disconnect", () => {
      console.log(`❌ Disconnected: ${socket.id}`);
    });
  });

  return io;
};

// helpers
const emitToUser = (userId, event, payload) => {
  if (!io) return;
  io.to(`user_${userId}`).emit(event, payload);
};

const emitToRole = (role, event, payload) => {
  if (!io) return;
  io.to(role).emit(event, payload);
};

const emitToAll = (event, payload) => {
  if (!io) return;
  io.emit(event, payload);
};

module.exports = {
  initSocket,
  emitToUser,
  emitToRole,
  emitToAll,
};