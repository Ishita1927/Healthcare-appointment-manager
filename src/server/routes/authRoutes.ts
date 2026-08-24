import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../db/database';
import { generateToken, requireAuth } from '../middleware/auth';

const router = Router();

// Register new user (Patient or Doctor)
router.post('/register', (req, res) => {
  try {
    const { email, password, name, role = 'PATIENT', phone, specialization } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required.' });
    }

    if (!['PATIENT', 'DOCTOR', 'ADMIN'].includes(role)) {
      return res.status(400).json({ error: 'Invalid user role.' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    const userId = `user-${crypto.randomUUID()}`;
    const passwordHash = bcrypt.hashSync(password, 10);

    const registerTx = db.transaction(() => {
      db.prepare(`
        INSERT INTO users (id, email, password_hash, role, name, phone)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(userId, email.toLowerCase(), passwordHash, role, name, phone || null);

      if (role === 'DOCTOR') {
        const profileId = `profile-${crypto.randomUUID()}`;
        db.prepare(`
          INSERT INTO doctor_profiles (id, user_id, specialization, bio, working_hour_start, working_hour_end, slot_duration_minutes, working_days, consultation_fee)
          VALUES (?, ?, ?, ?, '09:00', '17:00', 30, '[1,2,3,4,5,6]', 800.0)
        `).run(profileId, userId, specialization || 'General Medicine', 'Dedicated healthcare specialist.');
      }
    });

    registerTx();

    const userObj = { id: userId, email: email.toLowerCase(), role, name };
    const token = generateToken(userObj as any);

    return res.status(201).json({
      message: 'Account created successfully.',
      token,
      user: userObj
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: err.message || 'Registration failed.' });
  }
});

// Login (Patient, Doctor, or Admin)
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase()) as any;
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const userObj = { id: user.id, email: user.email, role: user.role, name: user.name };
    const token = generateToken(userObj as any);

    return res.json({
      message: 'Login successful.',
      token,
      user: userObj
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// Get current user profile
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, email, role, name, phone, created_at FROM users WHERE id = ?').get(req.user!.id) as any;
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  let doctorProfile = null;
  if (user.role === 'DOCTOR') {
    doctorProfile = db.prepare('SELECT * FROM doctor_profiles WHERE user_id = ?').get(user.id);
  }

  return res.json({ user: { ...user, doctorProfile } });
});

// Demo accounts directory
router.get('/demo-accounts', (_req, res) => {
  const accounts = db.prepare(`
    SELECT u.id, u.email, u.role, u.name, dp.specialization, dp.consultation_fee
    FROM users u
    LEFT JOIN doctor_profiles dp ON u.id = dp.user_id
    ORDER BY u.role, dp.specialization, u.name
  `).all();

  return res.json({ accounts });
});

export default router;
