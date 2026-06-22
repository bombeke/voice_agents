/**
 * Android Simulator Preview Server
 *
 * Port 5000 (public-facing):
 *   GET /          → Android device frame HTML (iframe points to /?__sim__=1)
 *   Everything else → reverse-proxied to the Expo web dev server on port 4999
 *
 * This lets the Replit preview tab show the app inside an Android phone mockup.
 * WebSocket upgrade events are also proxied so Metro HMR (hot reload) works.
 */

const http = require("http");
const net = require("net");

const PORT = parseInt(process.env.PORT || "5000", 10);
const EXPO_PORT = 4999;

const FRAME_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Android Simulator — Overhead Vision</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: radial-gradient(ellipse at center, #1a1a2e 0%, #0d0d0d 100%);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      overflow: hidden;
    }

    .brand {
      color: #4a9eff;
      font-size: 11px;
      letter-spacing: 4px;
      text-transform: uppercase;
      margin-bottom: 18px;
      font-weight: 600;
      opacity: 0.8;
    }

    /* ── Phone shell ── */
    .device {
      position: relative;
      width: 375px;
      height: 812px;
      background: linear-gradient(145deg, #2a2a2a, #1a1a1a);
      border-radius: 52px;
      box-shadow:
        0 0 0 1px #555,
        0 0 0 3px #1a1a1a,
        0 50px 120px rgba(0,0,0,0.9),
        inset 0 1px 0 rgba(255,255,255,0.08);
    }

    /* Physical buttons */
    .btn {
      position: absolute;
      background: linear-gradient(180deg, #2e2e2e, #222);
      border-radius: 3px;
    }
    .vol-up  { left: -4px; top: 148px; width: 4px; height: 36px; }
    .vol-dn  { left: -4px; top: 196px; width: 4px; height: 36px; }
    .pwr     { right: -4px; top: 168px; width: 4px; height: 56px; }

    /* Screen bezel inside shell */
    .screen {
      position: absolute;
      inset: 10px 6px;
      background: #000;
      border-radius: 44px;
      overflow: hidden;
    }

    /* Status bar */
    .statusbar {
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 44px;
      z-index: 200;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      padding: 0 24px 8px;
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      pointer-events: none;
      background: linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 100%);
    }
    .notch {
      position: absolute;
      top: 0; left: 50%; transform: translateX(-50%);
      width: 126px; height: 34px;
      background: #000;
      border-radius: 0 0 20px 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      z-index: 201;
    }
    .notch-cam { width: 12px; height: 12px; background: #111; border-radius: 50%; border: 1px solid #2a2a2a; }
    .notch-ear { width: 42px; height: 5px; background: #111; border-radius: 3px; }
    .status-icons { display: flex; gap: 5px; align-items: center; font-size: 11px; }

    /* App iframe */
    #expo-frame {
      position: absolute;
      top: 0; left: 0;
      width: 100%;
      height: calc(100% - 34px);
      border: none;
      background: #000;
    }

    /* Home bar */
    .homebar {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      height: 34px;
      background: #000;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 200;
    }
    .homebar-pill {
      width: 120px; height: 5px;
      background: rgba(255,255,255,0.3);
      border-radius: 3px;
    }

    /* Loading overlay inside the screen */
    #loading {
      position: absolute;
      inset: 44px 0 34px;
      background: #111;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #666;
      font-size: 13px;
      gap: 14px;
      z-index: 50;
      transition: opacity 0.4s;
    }
    #loading.hidden { opacity: 0; pointer-events: none; }
    .spinner {
      width: 32px; height: 32px;
      border: 3px solid #333;
      border-top-color: #4a9eff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="brand">⬡ Overhead Vision — Android Simulator</div>

  <div class="device">
    <div class="btn vol-up"></div>
    <div class="btn vol-dn"></div>
    <div class="btn pwr"></div>

    <div class="screen">
      <!-- Notch / dynamic island -->
      <div class="notch">
        <div class="notch-ear"></div>
        <div class="notch-cam"></div>
      </div>

      <!-- Status bar -->
      <div class="statusbar">
        <span id="clk">12:00</span>
        <div style="width:126px"></div><!-- spacer for notch -->
        <div class="status-icons">
          <span>5G</span>
          <span>▓▓▓</span>
          <span>🔋</span>
        </div>
      </div>

      <!-- Loading state (shown until iframe responds) -->
      <div id="loading">
        <div class="spinner"></div>
        <span>Starting Metro bundler…</span>
      </div>

      <!-- App content -->
      <iframe
        id="expo-frame"
        src="/?__sim__=1"
        allow="camera; microphone; geolocation"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
      ></iframe>

      <!-- Home bar -->
      <div class="homebar"><div class="homebar-pill"></div></div>
    </div>
  </div>

  <script>
    // Live clock
    function tick() {
      const d = new Date();
      document.getElementById('clk').textContent =
        String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
    }
    tick();
    setInterval(tick, 30000);

    // Hide loading overlay once the iframe responds
    const frame = document.getElementById('expo-frame');
    const loading = document.getElementById('loading');
    let hideTimer;

    frame.addEventListener('load', () => {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => loading.classList.add('hidden'), 300);
    });

    // Auto-retry if Metro isn't ready yet
    function retryIfNeeded() {
      try {
        const body = frame.contentDocument && frame.contentDocument.body;
        if (body && body.textContent.includes('not ready')) {
          setTimeout(() => { frame.src = frame.src; }, 3000);
        }
      } catch (_) {}
    }
    frame.addEventListener('load', retryIfNeeded);
  </script>
</body>
</html>`;

// ── HTTP request proxy ──────────────────────────────────────────────────────

function proxyRequest(req, res) {
  const opts = {
    hostname: "127.0.0.1",
    port: EXPO_PORT,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `localhost:${EXPO_PORT}` },
  };

  const proxy = http.request(opts, (pr) => {
    res.writeHead(pr.statusCode, pr.headers);
    pr.pipe(res, { end: true });
  });

  proxy.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(
        "<html><body style='background:#111;color:#666;font-family:sans-serif;" +
          "display:flex;align-items:center;justify-content:center;height:100vh;" +
          "margin:0;font-size:13px'>Metro bundler starting — please wait…</body></html>",
      );
    }
  });

  req.pipe(proxy, { end: true });
}

// ── WebSocket proxy (for Metro HMR) ────────────────────────────────────────

function proxyWebSocket(req, socket, head) {
  const proxy = net.connect(EXPO_PORT, "127.0.0.1", () => {
    // Reconstruct the upgrade request
    const headers = Object.entries(req.headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\r\n");
    proxy.write(
      `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${headers}\r\n\r\n`,
    );
    if (head && head.length) proxy.write(head);
    proxy.pipe(socket);
    socket.pipe(proxy);
  });
  proxy.on("error", () => socket.destroy());
  socket.on("error", () => proxy.destroy());
}

// ── Server ──────────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", "http://localhost");

  // Root without __sim__ param → serve the Android frame shell
  if (url.pathname === "/" && !url.searchParams.has("__sim__")) {
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    });
    res.end(FRAME_HTML);
    return;
  }

  // Everything else (including /?__sim__=1 and all asset paths) → Expo
  proxyRequest(req, res);
});

server.on("upgrade", proxyWebSocket);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n✔ Android Simulator running on port ${PORT}`);
  console.log(`  Frame  → http://localhost:${PORT}/`);
  console.log(`  Expo   → http://localhost:${EXPO_PORT}/ (proxied)\n`);
});
