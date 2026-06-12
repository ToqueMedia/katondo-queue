// Upload routes — single file uploads for ad media & custom chime sounds

import { Router } from 'express';
import type { Request, Response } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { uploadMiddleware, chimeUploadMiddleware } from '../upload.js';

const router = Router();

// POST /api/upload/ad-media — upload image/video for advertisements
router.post('/ad-media', authMiddleware, requireRole('management'), (req: Request, res: Response) => {
  uploadMiddleware.single('file')(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Ficheiro demasiado grande. O limite máximo permitido é de 100MB.' });
      }
      return res.status(400).json({ error: err.message || 'Erro ao carregar o ficheiro.' });
    }

    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Ficheiro não enviado.' });
    const baseUrl = process.env.UPLOAD_BASE_URL || `/uploads/${file.filename}`;
    res.status(201).json({ url: baseUrl, filename: file.filename });
  });
});

// POST /api/upload/chime-sound — upload custom chime sound (strictly restricted to MP3 only)
router.post('/chime-sound', authMiddleware, requireRole('management'), (req: Request, res: Response) => {
  chimeUploadMiddleware.single('file')(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Ficheiro demasiado grande. O limite máximo permitido é de 10MB.' });
      }
      return res.status(400).json({ error: err.message || 'Erro ao carregar o ficheiro de som.' });
    }

    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Ficheiro de som não enviado.' });
    const baseUrl = process.env.UPLOAD_BASE_URL || `/uploads/${file.filename}`;
    res.status(201).json({ url: baseUrl, filename: file.filename });
  });
});

export default router;
