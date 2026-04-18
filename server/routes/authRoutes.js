import { Router } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import auth from '../middleware/auth.js';

const router = Router();

// ─── Register ───
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase();

    // Default User Bypass for Samuel
    if (normalizedEmail === 'samuelvelicharla@gmail.com' && password === 'Samuel@2006') {
      const token = jwt.sign(
        { id: '67b3f0000000000000000000', name: name || 'Samuel', email: normalizedEmail },
        process.env.JWT_SECRET || 'mapRouterAI2026SecretKey',
        { expiresIn: '7d' }
      );

      return res.status(201).json({
        success: true,
        token,
        user: { id: '67b3f0000000000000000000', name: name || 'Samuel', email: normalizedEmail },
      });
    }

    if (!name) return res.status(400).json({ success: false, error: 'Name is required' });
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Email already registered' });
    }

    const user = await User.create({ name, email: email.toLowerCase(), password });

    const token = jwt.sign(
      { id: user._id, name: user.name, email: user.email },
      process.env.JWT_SECRET || 'mapRouterAI2026SecretKey',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error('[Auth] Register error:', err.message);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

// ─── Login ───
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase();

    // Default Login Bypass for Samuel
    if (normalizedEmail === 'samuelvelicharla@gmail.com' && password === 'Samuel@2006') {
      const defaultUser = {
        _id: '67b3f0000000000000000000', // Mock MongoDB ID
        name: 'Samuel',
        email: 'samuelvelicharla@gmail.com'
      };
      
      const token = jwt.sign(
        { id: defaultUser._id, name: defaultUser.name, email: defaultUser.email },
        process.env.JWT_SECRET || 'mapRouterAI2026SecretKey',
        { expiresIn: '7d' }
      );

      return res.json({
        success: true,
        token,
        user: { id: defaultUser._id, name: defaultUser.name, email: defaultUser.email },
      });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(400).json({ success: false, error: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user._id, name: user.name, email: user.email },
      process.env.JWT_SECRET || 'mapRouterAI2026SecretKey',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error('[Auth] Login error:', err.message);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// ─── Get current user ───
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, user });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get user' });
  }
});

export default router;
