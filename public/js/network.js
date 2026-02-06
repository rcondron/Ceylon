// ═══════════════════════════════════════════════════════════════════════════
// Crown of Ceylon — Network Layer (WebSocket Client)
// Handles connection, message sending/receiving, and state synchronization.
// ═══════════════════════════════════════════════════════════════════════════

const Network = (() => {
  let ws = null;
  let playerId = null;
  let connected = false;
  let messageHandlers = {};
  let reconnectAttempts = 0;
  const MAX_RECONNECT = 5;

  function connect() {
    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}`;

      ws = new WebSocket(url);

      ws.onopen = () => {
        connected = true;
        reconnectAttempts = 0;
        console.log('Connected to server');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'init') {
            playerId = msg.playerId;
            resolve(msg);
          }
          // Dispatch to handlers
          const handlers = messageHandlers[msg.type];
          if (handlers) {
            for (const handler of handlers) {
              handler(msg);
            }
          }
        } catch (e) {
          console.error('Failed to parse message:', e);
        }
      };

      ws.onclose = () => {
        connected = false;
        console.log('Disconnected from server');
        // Auto-reconnect
        if (reconnectAttempts < MAX_RECONNECT) {
          reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
          console.log(`Reconnecting in ${delay}ms...`);
          setTimeout(() => connect().catch(() => {}), delay);
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        reject(err);
      };
    });
  }

  function send(msg) {
    if (ws && connected) {
      ws.send(JSON.stringify(msg));
    }
  }

  function on(type, handler) {
    if (!messageHandlers[type]) {
      messageHandlers[type] = [];
    }
    messageHandlers[type].push(handler);
  }

  function off(type, handler) {
    if (messageHandlers[type]) {
      messageHandlers[type] = messageHandlers[type].filter(h => h !== handler);
    }
  }

  // ── Convenience methods ───────────────────────────────────────────────

  function moveUnits(unitIds, targetX, targetY) {
    send({
      type: 'move_units',
      unitIds,
      targetX,
      targetY,
    });
  }

  function assignTask(unitId, task, targetId, targetX, targetY) {
    send({
      type: 'assign_task',
      unitId,
      task,
      targetId,
      targetX,
      targetY,
    });
  }

  function requestBuild(buildingType, x, y) {
    send({
      type: 'build',
      buildingType,
      x,
      y,
    });
  }

  function sellToMarket(resource, amount) {
    send({
      type: 'sell_to_market',
      resource,
      amount,
    });
  }

  function tradeWith(targetPlayerId, offer, request) {
    send({
      type: 'trade',
      targetPlayerId,
      offer,
      request,
    });
  }

  function chat(text) {
    send({ type: 'chat', text });
  }

  return {
    connect,
    send,
    on,
    off,
    moveUnits,
    assignTask,
    requestBuild,
    sellToMarket,
    tradeWith,
    chat,
    get playerId() { return playerId; },
    get connected() { return connected; },
  };
})();
