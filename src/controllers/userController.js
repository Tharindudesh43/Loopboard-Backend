const mongoose = require('mongoose');
const User = require('../models/User');
const Task = require('../models/Task');

/**
 * GET /api/users
 * Admin-only. Powers the admin dashboard's user list and the
 * reassignment dropdown on each task. User.toJSON already strips
 * passwordHash, so nothing extra needs to happen here.
 */
async function listUsers(req, res) {
  try {
    const users = await User.find().sort({ createdAt: 1 });
    return res.json({ users });
  } catch (err) {
    console.error('listUsers error:', err);
    return res.status(500).json({ error: 'Failed to load users' });
  }
}

/**
 * DELETE /api/users/:id
 * Admin-only. Admins can't be deleted through this endpoint (there's no
 * account-recovery flow in this assignment, so removing the only admin
 * would be unrecoverable). Deleting a user cascades: tasks they were
 * assigned keep existing but become unassigned again, and tasks they
 * created are removed entirely (a task can't meaningfully exist with no
 * creator on record).
 */
async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }
    const target = await User.findById(id);

    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (target.role === 'ADMIN') {
      return res.status(403).json({ error: 'Admin accounts cannot be deleted' });
    }

    await Task.updateMany({ assignedUser: target._id }, { assignedUser: null });
    await Task.deleteMany({ creator: target._id });
    await target.deleteOne();

    return res.json({ success: true });
  } catch (err) {
    console.error('deleteUser error:', err);
    return res.status(500).json({ error: 'Failed to delete user' });
  }
}

module.exports = { listUsers, deleteUser };
