const express = require('express');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  addMember,
  removeMember,
} = require('../controllers/projectController');

const router = express.Router();

// Every route requires a valid JWT. listProjects itself branches on role
// (admin sees all, normal users see only projects they're a member of);
// everything that creates/edits/deletes or changes membership is admin-only.
router.get('/', auth, listProjects);
router.post('/', auth, requireAdmin, createProject);
router.patch('/:id', auth, requireAdmin, updateProject);
router.delete('/:id', auth, requireAdmin, deleteProject);
router.post('/:id/members', auth, requireAdmin, addMember);
router.delete('/:id/members/:userId', auth, requireAdmin, removeMember);

module.exports = router;
