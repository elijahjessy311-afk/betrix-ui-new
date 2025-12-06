import WebSocket, { WebSocketServer } from 'ws';

let wss = null;

export function startRealtimeServer(_options = {}) {
  const port = Number(process.env.WS_PORT || (Number(process.env.PORT || 5000) + 1));
  if (wss) return wss;
  wss = new WebSocketServer({ port });
  wss.on('connection', (socket) => {
    socket.isAlive = true;
    socket.on('pong', () => socket.isAlive = true);
    socket.on('message', (msg) => {
      try {
        const data = typeof msg === 'string' ? msg : msg.toString();
        // simple ping/pong or subscribe messages
        if (data === 'ping') return socket.send('pong');
      } catch (e) { void e; }
    });
  });

  // heartbeat
  const iv = setInterval(() => {
    wss.clients.forEach((s) => {
      if (!s.isAlive) return s.terminate();
      s.isAlive = false;
      s.ping();
    });
  }, 30000);

  wss.on('close', () => { try { clearInterval(iv); } catch (e) { void e; } });
  console.log(`Realtime WS server listening on port ${port}`);
  return wss;
}

export function broadcast(obj) {
  if (!wss) return 0;
  const data = typeof obj === 'string' ? obj : JSON.stringify(obj);
  let count = 0;
  wss.clients.forEach((c) => { if (c.readyState === WebSocket.OPEN) { c.send(data); count++; } });
  return count;
}

export default { startRealtimeServer, broadcast };
