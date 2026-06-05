// File upload configuration — local storage for ad media

import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const storage = multer.diskStorage({
  destination: (_req: any, _file: any, cb: any) => {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    // eslint-disable-next-line no-sync
    import('fs').then(({ mkdirSync }) => {
      try { mkdirSync(uploadDir, { recursive: true }); } catch {}
      cb(null, uploadDir);
    }).catch(() => cb(null, uploadDir));
  },
  filename: (_req: any, file: any, cb: any) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = file.originalname
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_');
    const timestamp = Date.now();
    const name = path.basename(safe, ext);
    cb(null, `${timestamp}-${name}${ext}`);
  },
});

const fileFilter = (_req: any, file: any, cb: any) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new Error('Tipo de ficheiro não permitido. Use JPG/PNG/WebP/MP4/WebM/MOV.'));
};

const chimeFileFilter = (_req: any, file: any, cb: any) => {
  const allowed = ['audio/mpeg', 'audio/mp3', 'audio/x-mpeg', 'audio/mpeg3', 'audio/x-mpeg-3'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(file.mimetype) || ext === '.mp3') {
    return cb(null, true);
  }
  cb(new Error('Tipo de ficheiro não permitido. Por favor, envie apenas ficheiros de som no formato MP3 (.mp3).'));
};

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: { fileSize: 200 * 1024 * 1024 }, // Aumentado para 200MB para suportar vídeos maiores
});

export const chimeUploadMiddleware = multer({
  storage,
  fileFilter: chimeFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for chime sounds
});
