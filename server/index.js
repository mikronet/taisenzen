require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');
const { initDb } = require('./db');
const db = require('./db');
const { uploadsDir } = require('./upload');

const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true, // TLS on port 465
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

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
  const io = new Server(server, {
    cors: {
      origin: process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : false,
      methods: ['GET', 'POST']
    }
  });

  app.use(cors());
  app.use(express.json());

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
    // Save to DB
    db.prepare('INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)').run(
      String(name).slice(0, 200),
      String(email).slice(0, 200),
      String(message).slice(0, 2000)
    );
    // Send email
    try {
      await mailer.sendMail({
        from: `"TAISEN Contacto" <${process.env.SMTP_USER}>`,
        to: process.env.CONTACT_TO,
        replyTo: String(email).slice(0, 200),
        subject: `[TAISEN] Nuevo contacto de ${String(name).slice(0, 100)}`,
        text: `Nombre: ${name}\nEmail: ${email}\n\n${message}`,
        html: `<p><strong>Nombre:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><hr/><p>${String(message).replace(/\n/g, '<br/>')}</p>`,
      });
    } catch (err) {
      console.error('Contact email error:', err.message);
      // Still return success — message was saved to DB
    }
    res.json({ success: true });
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
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

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Battle App running on port ${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
