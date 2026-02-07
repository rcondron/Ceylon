// ═══════════════════════════════════════════════════════════════════════════
// Crown of Ceylon — Network Layer (WebSocket Client)
// Handles multiplayer sync: player positions, farming, trading, chat.
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
    if (!messageHandlers[type]) messageHandlers[type] = [];
    messageHandlers[type].push(handler);
  }

  function off(type, handler) {
    if (messageHandlers[type]) {
      messageHandlers[type] = messageHandlers[type].filter(h => h !== handler);
    }
  }

  // ── Game actions ────────────────────────────────────────────────────────

  function sendPlayerPosition(x, y, direction, moving) {
    send({ type: 'player_move', x, y, direction, moving });
  }

  function sendFarmAction(action, tx, ty, cropType) {
    send({ type: 'farm_action', action, x: tx, y: ty, cropType });
  }

  function sendGather(nodeId) {
    send({ type: 'gather', nodeId });
  }

  function sendCraft(recipe) {
    send({ type: 'craft', recipe });
  }

  function sendBuild(buildingType, x, y) {
    send({ type: 'build', buildingType, x, y });
  }

  function sellToMarket(resource, amount) {
    send({ type: 'sell_to_market', resource, amount });
  }

  function tradeWith(targetPlayerId, offer, request) {
    send({ type: 'trade', targetPlayerId, offer, request });
  }

  function sendCreateTradeRoute(path, goods) {
    send({ type: 'create_trade_route', path, goods });
  }

  function chat(text) {
    send({ type: 'chat', text });
  }

  function requestSleep() {
    send({ type: 'sleep' });
  }

  return {
    connect,
    send,
    on,
    off,
    sendPlayerPosition,
    sendFarmAction,
    sendGather,
    sendCraft,
    sendBuild,
    sellToMarket,
    tradeWith,
    sendCreateTradeRoute,
    chat,
    requestSleep,
    get playerId() { return playerId; },
    get connected() { return connected; },
  };
})();
