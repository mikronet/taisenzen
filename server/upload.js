const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '..', 'data', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const ALLOWED_EXT  = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

const AUDIO_MIME = new Set(['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/ogg', 'audio/x-wav', 'audio/x-m4a']);
const AUDIO_EXT  = new Set(['.mp3', '.mp4', '.m4a', '.aac', '.wav', '.ogg']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_MIME.has(file.mimetype) && ALLOWED_EXT.has(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Solo se aceptan imágenes (jpg, png, gif, webp).'));
  }
}

// Combined filter for participant forms (photo + audio)
function fileFilterParticipant(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (file.fieldname === 'photo') {
    if (ALLOWED_MIME.has(file.mimetype) && ALLOWED_EXT.has(ext))
      return cb(null, true);
    return cb(new Error('Formato de imagen no válido. Solo jpg, png, gif, webp.'));
  }
  if (file.fieldname === 'audio') {
    if (AUDIO_MIME.has(file.mimetype) && AUDIO_EXT.has(ext))
      return cb(null, true);
    return cb(new Error('Formato de audio no válido. Se aceptan MP3, AAC, WAV, OGG.'));
  }
  cb(new Error('Campo de archivo no reconocido.'));
}

const upload = multer({ storage, fileFilter, limits: { fileSize: 8 * 1024 * 1024 } });

// Multer instance for participant endpoints (photo ≤8MB + audio ≤30MB)
const uploadParticipant = multer({ storage, fileFilter: fileFilterParticipant, limits: { fileSize: 30 * 1024 * 1024 } });

module.exports = { upload, uploadParticipant, uploadsDir };
