const express = require('express');
const { requestEmailOtp, verifyEmailOtp } = require('../controllers/authController');

const router = express.Router();

router.post('/email/request-otp', requestEmailOtp);
router.post('/email/verify-otp', verifyEmailOtp);

module.exports = router;
