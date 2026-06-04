// socket.js
let io = null;

/**
 * Initialize Socket.IO instance
 * Called once from server.js
 */
const initSocket = (serverIO) => {
  io = serverIO;

  io.on("connection", (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // Join user-specific room
    socket.on("join_user_room", (userId) => {
      socket.join(`user_${userId}`);
      console.log(`👤 Joined user room: user_${userId}`);
    });

    // Join role-based rooms (admin / organizer)
    socket.on("join_role_room", (role) => {
      socket.join(role);
      console.log(`🏷️ Joined role room: ${role}`);
    });

    socket.on("disconnect", () => {
      console.log(`❌ Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

/**
 * Emit to a specific user
 */
const emitToUser = (userId, event, payload) => {
  if (!io) return;
  io.to(`user_${userId}`).emit(event, payload);
};

/**
 * Emit to a role group (admin / organizer)
 */
const emitToRole = (role, event, payload) => {
  if (!io) return;
  io.to(role).emit(event, payload);
};

/**
 * Broadcast to everyone
 */
const emitToAll = (event, payload) => {
  if (!io) return;
  io.emit(event, payload);
};

/**
 * Emit to a specific event context (future scalability)
 */
const emitEvent = (event, payload) => {
  if (!io) return;
  io.emit(event, payload);
};

module.exports = {
  initSocket,
  emitToUser,
  emitToRole,
  emitToAll,
  emitEvent
};