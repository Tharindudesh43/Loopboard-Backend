const express = require('express');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const { listUsers, deleteUser } = require('../controllers/userController');

const router = express.Router();

router.get('/', auth, requireAdmin, listUsers);
router.delete('/:id', auth, requireAdmin, deleteUser);

module.exports = router;
