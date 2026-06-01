const { Server } = require('socket.io');

let io = null;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS']
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket client connected: ${socket.id}`);

    // Join tenant-specific room for real-time updates isolation
    socket.on('join_tenant', (tenantId) => {
      if (tenantId) {
        socket.join(tenantId);
        console.log(`👤 Client ${socket.id} joined tenant room: ${tenantId}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket client disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getIo = () => {
  return io;
};

// Central helper to broadcast order update event to a specific tenant room
const broadcastOrderUpdate = (tenantId, type = 'update') => {
  if (io && tenantId) {
    io.to(tenantId).emit('order_update', { type });
    console.log(`⚡ Broadcasted order_update (${type}) to tenant room: ${tenantId}`);
  }
};

module.exports = { initSocket, getIo, broadcastOrderUpdate };
