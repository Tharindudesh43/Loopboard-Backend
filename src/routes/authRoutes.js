const express = require('express');
const { register, login, me, updateMe } = require('../controllers/authController');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', auth, me);
router.patch('/me', auth, updateMe);

module.exports = router;
