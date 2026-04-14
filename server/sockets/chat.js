const { randomUUID } = require('crypto');

// ── In-memory stores ─────────────────────────────────────────────────────────
const users = new Map();          // socketId → { id, username, color, joinedAt }
const conversations = new Map();  // "id1::id2" (sorted) → [ message, … ]
const lastSeen = new Map();       // socketId → ISO timestamp (updated on disconnect)

const COLORS = [
  '#FF6B6B', '#FFA94D', '#FFD43B', '#69DB7C',
  '#4DABF7', '#9775FA', '#F783AC', '#63E6BE',
];
let colorIdx = 0;

// ── Helpers ──────────────────────────────────────────────────────────────────

function convoKey(a, b) {
  return [a, b].sort().join('::');
}

function addUser(socketId, username) {
  username = (username || '').trim().slice(0, 24);
  if (!username) return { ok: false, error: 'Username is required' };

  const taken = [...users.values()].some(
    (u) => u.username.toLowerCase() === username.toLowerCase()
  );
  if (taken) return { ok: false, error: 'Username already taken' };

  const user = {
    id: socketId,
    username,
    color: COLORS[colorIdx++ % COLORS.length],
    joinedAt: new Date().toISOString(),
  };
  users.set(socketId, user);
  return { ok: true, user };
}

function removeUser(socketId) {
  const user = users.get(socketId) ?? null;
  if (user) {
    lastSeen.set(user.username, new Date().toISOString());
  }
  users.delete(socketId);
  return user;
}

function createDM(sender, rawText, replyTo) {
  const text = (rawText || '').trim().slice(0, 1000);
  if (!text) return null;
  const msg = {
    id: randomUUID(),
    senderId: sender.id,
    senderName: sender.username,
    senderColor: sender.color,
    text,
    timestamp: new Date().toISOString(),
    reactions: {},      // { emoji: [userId, …] }
    deleted: false,
    readBy: [],         // [userId, …]
  };
  if (replyTo) {
    msg.replyTo = replyTo; // { id, text, senderName }
  }
  return msg;
}

function storeMessage(key, message) {
  if (!conversations.has(key)) conversations.set(key, []);
  const msgs = conversations.get(key);
  msgs.push(message);
  if (msgs.length > 200) msgs.splice(0, msgs.length - 200);
}

function findMessage(key, messageId) {
  const msgs = conversations.get(key);
  if (!msgs) return null;
  return msgs.find(m => m.id === messageId) || null;
}

// ── Handler registration ──────────────────────────────────────────────────────

function registerChatHandlers(io, socket) {

  // ── Join ──
  socket.on('user:join', (username, ack) => {
    const result = addUser(socket.id, username);
    if (!result.ok) return ack?.({ error: result.error });

    socket.broadcast.emit('user:joined', {
      user: result.user,
      onlineCount: users.size,
    });
    io.emit('users:list', [...users.values()]);
    ack?.({ ok: true, user: result.user });
    console.log(`[join] ${result.user.username}`);
  });

  // ── Send DM ──
  socket.on('dm:send', (payload, ack) => {
    const sender = users.get(socket.id);
    if (!sender) return ack?.({ error: 'Not joined' });

    const { to, text, replyTo } = payload || {};
    if (!to) return ack?.({ error: 'Recipient required' });

    const recipient = users.get(to);
    if (!recipient) return ack?.({ error: 'User is offline' });

    const message = createDM(sender, text, replyTo || null);
    if (!message) return ack?.({ error: 'Empty message' });

    message.receiverId = to;

    const key = convoKey(socket.id, to);
    storeMessage(key, message);

    io.to(to).emit('dm:receive', message);
    socket.emit('dm:receive', message);

    ack?.({ ok: true, message });
  });

  // ── Get DM History ──
  socket.on('dm:history', (payload, ack) => {
    const { withUser } = payload || {};
    if (!withUser) return ack?.({ error: 'withUser required' });

    const key = convoKey(socket.id, withUser);
    const messages = conversations.get(key) || [];
    ack?.({ ok: true, messages });
  });

  // ── Read Receipts ──
  socket.on('dm:read', (payload) => {
    const { fromUser, messageIds } = payload || {};
    if (!fromUser || !messageIds?.length) return;

    const key = convoKey(socket.id, fromUser);
    const msgs = conversations.get(key);
    if (!msgs) return;

    const updated = [];
    for (const msg of msgs) {
      if (messageIds.includes(msg.id) && !msg.readBy.includes(socket.id)) {
        msg.readBy.push(socket.id);
        updated.push(msg.id);
      }
    }

    if (updated.length) {
      io.to(fromUser).emit('dm:read:update', {
        readBy: socket.id,
        messageIds: updated,
      });
    }
  });

  // ── Emoji Reactions ──
  socket.on('dm:react', (payload, ack) => {
    const { withUser, messageId, emoji } = payload || {};
    if (!withUser || !messageId || !emoji) return ack?.({ error: 'Missing fields' });

    const key = convoKey(socket.id, withUser);
    const msg = findMessage(key, messageId);
    if (!msg) return ack?.({ error: 'Message not found' });

    if (!msg.reactions[emoji]) msg.reactions[emoji] = [];
    const arr = msg.reactions[emoji];
    const idx = arr.indexOf(socket.id);
    if (idx >= 0) {
      arr.splice(idx, 1); // toggle off
      if (!arr.length) delete msg.reactions[emoji];
    } else {
      arr.push(socket.id); // toggle on
    }

    const update = { messageId, reactions: msg.reactions };
    io.to(withUser).emit('dm:react:update', update);
    socket.emit('dm:react:update', update);
    ack?.({ ok: true });
  });

  // ── Delete Message ──
  socket.on('dm:delete', (payload, ack) => {
    const { withUser, messageId } = payload || {};
    if (!withUser || !messageId) return ack?.({ error: 'Missing fields' });

    const key = convoKey(socket.id, withUser);
    const msg = findMessage(key, messageId);
    if (!msg) return ack?.({ error: 'Message not found' });
    if (msg.senderId !== socket.id) return ack?.({ error: 'Can only delete your own messages' });

    msg.deleted = true;
    msg.text = '';
    msg.reactions = {};
    msg.replyTo = null;

    const update = { messageId };
    io.to(withUser).emit('dm:delete:update', update);
    socket.emit('dm:delete:update', update);
    ack?.({ ok: true });
  });

  // ── Search Messages ──
  socket.on('dm:search', (payload, ack) => {
    const { withUser, query } = payload || {};
    if (!withUser || !query) return ack?.({ ok: true, results: [] });

    const key = convoKey(socket.id, withUser);
    const msgs = conversations.get(key) || [];
    const q = query.toLowerCase();
    const results = msgs
      .filter(m => !m.deleted && m.text.toLowerCase().includes(q))
      .slice(-30);
    ack?.({ ok: true, results });
  });

  // ── DM Typing ──
  socket.on('dm:typing:start', (payload) => {
    const sender = users.get(socket.id);
    if (!sender || !payload?.to) return;
    io.to(payload.to).emit('dm:typing:update', {
      userId: socket.id,
      username: sender.username,
      typing: true,
    });
  });

  socket.on('dm:typing:stop', (payload) => {
    if (!payload?.to) return;
    io.to(payload.to).emit('dm:typing:update', {
      userId: socket.id,
      typing: false,
    });
  });

  // ── Get Last Seen ──
  socket.on('user:lastSeen', (payload, ack) => {
    const { username: uname } = payload || {};
    const ts = lastSeen.get(uname) || null;
    ack?.({ ok: true, lastSeen: ts });
  });

  // ── Disconnect ──
  socket.on('disconnect', () => {
    const user = removeUser(socket.id);
    if (user) {
      io.emit('user:left', { user, onlineCount: users.size });
      io.emit('users:list', [...users.values()]);
      console.log(`[leave] ${user.username}`);
    }
    console.log(`[disconnect] ${socket.id}`);
  });
}

module.exports = { registerChatHandlers };