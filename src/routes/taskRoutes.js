const express = require('express');
const auth = require('../middleware/auth');
const {
  getTasks,
  createTask,
  assignTask,
  updateStatus,
  updateTask,
  deleteTask,
} = require('../controllers/taskController');

const router = express.Router();

router.use(auth);

router.get('/', getTasks);
router.post('/', createTask);
router.patch('/:id/assign', assignTask);
router.patch('/:id/status', updateStatus);
router.patch('/:id', updateTask);
router.delete('/:id', deleteTask);

module.exports = router;
