import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { log } from '../lib/logger';

const router = Router();

// Public admin login route (no auth middleware). This router is mounted at /api/admin BEFORE the secured admin router.
router.post('/login', (req, res) => {
  const password = req.body?.password;
  if (!password || password !== config.adminPassword) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  const token = jwt.sign({ role: 'admin' }, config.adminJwtSecret, { expiresIn: '12h' });
  res.json({ token });
});

export default router;
