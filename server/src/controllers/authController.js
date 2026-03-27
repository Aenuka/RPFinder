const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const Group = require('../models/groupModel');

const normalizeItNumber = (value) => String(value || '').trim().toUpperCase();
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const otpStore = new Map();

const getSmtpTransport = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || 'false') === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    const error = new Error('SMTP credentials are not configured.');
    error.statusCode = 500;
    throw error;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
};

const ensureMemberExists = async (itNumber, email) => {
  const groups = await Group.find({
    members: {
      $elemMatch: {
        itNumber,
        email,
      },
    },
  }).limit(1);

  return groups.length > 0;
};

const requestEmailOtp = async (req, res, next) => {
  try {
    const itNumber = normalizeItNumber(req.body.itNumber);
    const email = normalizeEmail(req.body.email);

    if (!/^IT\d{8}$/.test(itNumber)) {
      return res.status(400).json({ message: 'IT number must be in ITXXXXXXXX format.' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Email format is invalid.' });
    }

    const memberExists = await ensureMemberExists(itNumber, email);

    if (!memberExists) {
      return res.status(404).json({ message: 'No member found with this IT number and email.' });
    }

    const otpCode = String(crypto.randomInt(100000, 1000000));
    const expiresAt = Date.now() + 5 * 60 * 1000;
    const key = `${itNumber}:${email}`;
    otpStore.set(key, { otpCode, expiresAt });

    const transporter = getSmtpTransport();
    const from = process.env.EMAIL_FROM || process.env.SMTP_USER;

    await transporter.sendMail({
      from,
      to: email,
      subject: 'RP Finder OTP Verification',
      text: `Your RP Finder OTP is ${otpCode}. It expires in 5 minutes.`,
    });

    return res.status(200).json({ message: 'Email OTP sent successfully.' });
  } catch (error) {
    return next(error);
  }
};

const verifyEmailOtp = async (req, res, next) => {
  try {
    const itNumber = normalizeItNumber(req.body.itNumber);
    const email = normalizeEmail(req.body.email);
    const otpCode = String(req.body.otpCode || '').trim();

    if (!/^IT\d{8}$/.test(itNumber)) {
      return res.status(400).json({ message: 'IT number must be in ITXXXXXXXX format.' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Email format is invalid.' });
    }

    if (!/^\d{4,8}$/.test(otpCode)) {
      return res.status(400).json({ message: 'OTP code is invalid.' });
    }

    const memberExists = await ensureMemberExists(itNumber, email);

    if (!memberExists) {
      return res.status(404).json({ message: 'No member found with this IT number and email.' });
    }

    const key = `${itNumber}:${email}`;
    const record = otpStore.get(key);

    if (!record) {
      return res.status(400).json({ message: 'No OTP request found. Please request a new OTP.' });
    }

    if (Date.now() > record.expiresAt) {
      otpStore.delete(key);
      return res.status(400).json({ message: 'OTP expired. Please request a new OTP.' });
    }

    if (record.otpCode !== otpCode) {
      return res.status(400).json({ message: 'OTP verification failed. Please try again.' });
    }

    otpStore.delete(key);

    const jwtSecret = process.env.JWT_SECRET || 'replace-with-secure-secret';
    const token = jwt.sign({ itNumber, email }, jwtSecret, { expiresIn: '2h' });

    return res.status(200).json({
      message: 'Email OTP verified successfully.',
      token,
      profile: { itNumber, email },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  requestEmailOtp,
  verifyEmailOtp,
};
