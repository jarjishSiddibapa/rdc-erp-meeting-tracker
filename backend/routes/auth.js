const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { sendPasswordResetEmail } = require('../services/mailer');
const { EMAIL_REGEX } = require('../utils/validation');
const { hashToken, createResetToken } = require('../utils/resetToken');

const router = express.Router();

// Login identifies by email now (no username field in the app). Unlike forgot-password,
// this deliberately tells the user WHICH part was wrong — "wrong email" vs "wrong
// password" — since this is an internal LAN tool for known company staff, not a public
// signup service, so the usual "don't confirm which accounts exist" tradeoff isn't worth
// the confusion it causes for everyday logins.
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required' });
    if (!EMAIL_REGEX.test(email))
      return res.status(400).json({ message: 'Please enter a valid email address' });

    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE email = ? AND is_deleted = 0',
      [email]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ message: 'No account found with this email' });
    if (!user.is_active) return res.status(401).json({ message: 'This account has been deactivated. Contact your admin.' });

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return res.status(401).json({ message: 'Incorrect password' });

    const token = jwt.sign(
      { id: user.id, role: user.role, full_name: user.full_name, can_edit_digitization: !!user.can_edit_digitization },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      token,
      user: { id: user.id, full_name: user.full_name, role: user.role, email: user.email, can_edit_digitization: !!user.can_edit_digitization }
    });
  } catch (e) { next(e); }
});

router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password)
      return res.status(400).json({ message: 'Both passwords required' });
    if (new_password.length < 6)
      return res.status(400).json({ message: 'New password must be at least 6 characters' });

    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ? AND is_deleted = 0', [req.user.id]);
    const user = rows[0];
    if (!user || !bcrypt.compareSync(current_password, user.password))
      return res.status(401).json({ message: 'Current password is incorrect' });

    const hashed = bcrypt.hashSync(new_password, 10);
    await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);
    res.json({ message: 'Password changed successfully' });
  } catch (e) { next(e); }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, full_name, email, role, can_edit_digitization FROM users WHERE id = ? AND is_deleted = 0',
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'User not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// Always responds with a generic success message, whether or not the email matched an
// account — avoids leaking which emails are registered.
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });
    if (!EMAIL_REGEX.test(email)) return res.status(400).json({ message: 'Please enter a valid email address' });

    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE email = ? AND is_deleted = 0 AND is_active = 1',
      [email]
    );
    const user = rows[0];

    if (user) {
      const rawToken = await createResetToken(user.id);
      const resetUrl = `${req.protocol}://${req.get('host')}/reset-password?token=${rawToken}`;
      try {
        await sendPasswordResetEmail({ to: user.email, fullName: user.full_name, resetUrl });
      } catch (mailErr) {
        console.error('Failed to send password reset email:', mailErr.message);
      }
    }

    res.json({ message: 'If that email is registered, a reset link has been sent.' });
  } catch (e) { next(e); }
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, new_password } = req.body;
    if (!token || !new_password)
      return res.status(400).json({ message: 'Token and new password are required' });
    if (new_password.length < 6)
      return res.status(400).json({ message: 'New password must be at least 6 characters' });

    const tokenHash = hashToken(token);
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE reset_token_hash = ? AND reset_token_expires > NOW() AND is_deleted = 0',
      [tokenHash]
    );
    const user = rows[0];
    if (!user) return res.status(400).json({ message: 'This reset link is invalid or has expired' });

    const hashed = bcrypt.hashSync(new_password, 10);
    await pool.execute(
      'UPDATE users SET password = ?, reset_token_hash = NULL, reset_token_expires = NULL WHERE id = ?',
      [hashed, user.id]
    );
    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (e) { next(e); }
});

module.exports = router;
