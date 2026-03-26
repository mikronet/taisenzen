require('dotenv').config();
const express = require('express');
const http = require('http');
const fs = require('fs');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');
const { initDb } = require('./db');
const db = require('./db');
const { uploadsDir } = require('./upload');

// Validate required env vars at startup
const REQUIRED_ENV = ['ADMIN_PASSWORD'];
const OPTIONAL_ENV = { SMTP_HOST: 'email de contacto', SMTP_PASS: 'email de contacto', CONTACT_TO: 'destinatario de contactos' };
for (const v of REQUIRED_ENV) {
  if (!process.env[v]) { console.error(`[CONFIG] Variable obligatoria faltante: ${v}`); process.exit(1); }
}
for (const [v, desc] of Object.entries(OPTIONAL_ENV)) {
  if (!process.env[v]) console.warn(`[CONFIG] Variable opcional no configurada: ${v} (${desc})`);
}

const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

// Escape HTML to prevent injection in email body
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function start() {
  await initDb();

  const adminRoutes = require('./routes/admin');
  const judgeRoutes = require('./routes/judge');
  const tournamentRoutes = require('./routes/tournament');
  const authRoutes = require('./routes/auth');
  const coreoRoutes = require('./routes/coreo');
  const coreoJudgeRoutes = require('./routes/coreoJudge');
  const setupSocket = require('./socket');

  const app = express();
  const server = http.createServer(app);

  // Builds an origin checker that accepts the configured domain and all its subdomains
  function makeOriginChecker() {
    if (process.env.NODE_ENV === 'development') return 'http://localhost:5173';
    const domain = process.env.ALLOWED_DOMAIN; // e.g. "taisen.es"
    const extras = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    if (!domain && extras.length === 0) return false;
    return (origin, cb) => {
      if (!origin) return cb(null, true); // same-origin / server-to-server
      const ok = (domain && (origin === `https://${domain}` || origin.endsWith(`.${domain}`)))
        || extras.includes(origin);
      cb(ok ? null : new Error('CORS not allowed'), ok);
    };
  }

  const originChecker = makeOriginChecker();

  const io = new Server(server, {
    cors: { origin: originChecker, methods: ['GET', 'POST'] }
  });

  app.use(cors({ origin: originChecker, credentials: true }));
  app.use(express.json());

  // Security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss:; font-src 'self' data:; object-src 'none';"
      );
    }
    next();
  });

  app.use((req, res, next) => {
    req.io = io;
    next();
  });

  // Simple in-memory rate limiter for contact form (max 5 per IP per 15 min)
  const contactRateMap = new Map();
  const CONTACT_RATE_WINDOW = 15 * 60 * 1000;
  const CONTACT_RATE_MAX = 5;

  // Public contact form endpoint
  app.post('/api/contact', async (req, res) => {
    const ip = req.ip || req.socket.remoteAddress;
    const now = Date.now();
    const entries = (contactRateMap.get(ip) || []).filter(t => now - t < CONTACT_RATE_WINDOW);
    if (entries.length >= CONTACT_RATE_MAX) {
      return res.status(429).json({ error: 'Demasiadas solicitudes. Inténtalo más tarde.' });
    }
    entries.push(now);
    contactRateMap.set(ip, entries);

    const { name, email, message } = req.body;
    if (!name || !email || !message) return res.status(400).json({ error: 'Faltan campos' });
    try {
      db.prepare('INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)').run(
        String(name).slice(0, 200),
        String(email).slice(0, 200),
        String(message).slice(0, 2000)
      );
    } catch (err) {
      console.error('[contact] DB error:', err.message);
      return res.status(500).json({ error: 'Error al guardar el mensaje. Inténtalo más tarde.' });
    }
    // Send email (non-blocking — message is already saved to DB)
    if (process.env.SMTP_HOST && process.env.CONTACT_TO) {
      mailer.sendMail({
        from: `"TAISEN Contacto" <${process.env.SMTP_USER}>`,
        to: process.env.CONTACT_TO,
        replyTo: String(email).slice(0, 200),
        subject: `[TAISEN] Nuevo contacto de ${escHtml(String(name).slice(0, 100))}`,
        text: `Nombre: ${name}\nEmail: ${email}\n\n${message}`,
        html: `<p><strong>Nombre:</strong> ${escHtml(name)}</p><p><strong>Email:</strong> ${escHtml(email)}</p><hr/><p>${escHtml(message).replace(/\n/g, '<br/>')}</p>`,
      }).catch(err => console.error('[contact] Email error:', err.message));
    }
    res.json({ success: true });
  });

  // Health check endpoint (no sensitive info)
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/admin', adminRoutes);
  app.use('/api/judge', judgeRoutes);
  app.use('/api/tournament', tournamentRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/coreo', coreoRoutes);
  app.use('/api/coreo-judge', coreoJudgeRoutes);

  // Serve uploaded photos (participant images)
  app.use('/uploads', express.static(uploadsDir));

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
    });
  }

  setupSocket(io);

  // Periodic cleanup of expired admin sessions (every hour)
  setInterval(() => {
    try { db.prepare('DELETE FROM admin_sessions WHERE expires_at < ?').run(Date.now()); } catch { /* ignore */ }
  }, 60 * 60 * 1000).unref();

  // Global Express error handler — catches any error passed to next(err) or thrown sync in routes
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const errMsg = `[ERROR] ${req.method} ${req.path}: ${err.message || err}`;
    console.error(errMsg);
    if (process.env.NODE_ENV === 'production') {
      try {
        const logFile = path.join(__dirname, '..', 'data', 'errors.log');
        fs.appendFileSync(logFile, `${new Date().toISOString()} ${errMsg}\n`);
      } catch { /* ignore log errors */ }
    }
    if (res.headersSent) return next(err);
    if (err.message && err.message.includes('Tipo de archivo no permitido')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.info(`[SERVER] Escuchando en puerto ${PORT} (${process.env.NODE_ENV || 'development'})`);
  });
}

// Prevent crashes from uncaught sync errors outside route handlers
process.on('uncaughtException', (err) => {
  console.error('[FATAL] uncaughtException:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] unhandledRejection:', reason);
});

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
