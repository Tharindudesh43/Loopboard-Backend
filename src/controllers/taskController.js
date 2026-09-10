const mongoose = require('mongoose');
const Task = require('../models/Task');
const User = require('../models/User');
const Project = require('../models/Project');

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// Reused on every response so the frontend gets creator/assignee names,
// not just raw ObjectIds — Mongo's equivalent of a SQL join.
const POPULATE_FIELDS = [
  { path: 'creator', select: 'name email' },
  { path: 'assignedUser', select: 'name email' },
];

/**
 * True if this user may currently see/act on the given project's tasks.
 * Admins always pass. Normal users pass only if they appear in the
 * project's `members` array right now — this is the single choke point
 * that makes "access revoked = project disappears" apply uniformly to
 * every task action below, not just the list view.
 */
async function userCanAccessProject(user, projectId) {
  if (user.role === 'ADMIN') return true;
  if (!isValidId(projectId)) return false;
  const project = await Project.findById(projectId);
  if (!project) return false;
  return project.members.some((m) => m.toString() === user.id);
}

/**
 * GET /api/tasks?projectId=<id>
 * Tasks are always scoped to a single project now — there's no more
 * global cross-project board. A normal user must currently be a member
 * of that project; an admin can view any project's tasks.
 */
async function getTasks(req, res) {
  try {
    const { projectId } = req.query;
    if (!projectId || !isValidId(projectId)) {
      return res.status(400).json({ error: 'A valid projectId query parameter is required' });
    }

    const hasAccess = await userCanAccessProject(req.user, projectId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this project' });
    }

    const tasks = await Task.find({ project: projectId })
      .sort({ createdAt: -1 })
      .populate(POPULATE_FIELDS);
    return res.json({ tasks });
  } catch (err) {
    console.error('getTasks error:', err);
    return res.status(500).json({ error: 'Failed to fetch tasks' });
  }
}

/**
 * POST /api/tasks
 * Body: { projectId, title, description }. Any current member of the
 * project (or an admin) can create a task in it. It starts unassigned.
 */
async function createTask(req, res) {
  try {
    const { projectId, title, description } = req.body;

    if (!projectId || !isValidId(projectId)) {
      return res.status(400).json({ error: 'A valid projectId is required' });
    }
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'title is required' });
    }

    const hasAccess = await userCanAccessProject(req.user, projectId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this project' });
    }

    const task = await Task.create({
      title: title.trim(),
      description: description || '',
      project: projectId,
      creator: req.user.id,
      assignedUser: null,
      status: 'TODO',
    });

    const populated = await task.populate(POPULATE_FIELDS);
    return res.status(201).json({ task: populated });
  } catch (err) {
    console.error('createTask error:', err);
    return res.status(500).json({ error: 'Failed to create task' });
  }
}

/**
 * PATCH /api/tasks/:id/assign
 * Body: { userId } — matches what the frontend actually sends.
 * (Previously this read `assignedUserId`, which the frontend never sent —
 * every admin reassignment was silently falling through to "unassign".
 * Fixed as part of this project-scoping pass.)
 * Normal users may only self-assign a currently UNASSIGNED task.
 * Admins may assign (or unassign, via userId: null) any task to any user.
 */
async function assignTask(req, res) {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid task id' });

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const hasAccess = await userCanAccessProject(req.user, task.project);
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this project' });
    }

    if (req.user.role === 'ADMIN') {
      const { userId } = req.body;

      if (!userId) {
        task.assignedUser = null; // admin explicitly unassigning
      } else {
        if (!isValidId(userId)) {
          return res.status(400).json({ error: 'Invalid userId' });
        }
        const targetUser = await User.findById(userId);
        if (!targetUser) return res.status(404).json({ error: 'Target user not found' });
        task.assignedUser = userId;
      }
    } else {
      if (task.assignedUser) {
        return res.status(403).json({ error: 'Task is already assigned to someone else' });
      }
      task.assignedUser = req.user.id;
    }

    await task.save();
    const populated = await task.populate(POPULATE_FIELDS);
    return res.json({ task: populated });
  } catch (err) {
    console.error('assignTask error:', err);
    return res.status(500).json({ error: 'Failed to assign task' });
  }
}

/**
 * PATCH /api/tasks/:id/status
 * This is what the frontend's drag-and-drop calls.
 * Allowed for: the task's creator, its current assignee, or an admin —
 * and only if that person currently has access to the parent project.
 */
async function updateStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid task id' });
    if (!['TODO', 'DOING', 'DONE'].includes(status)) {
      return res.status(400).json({ error: 'status must be one of TODO, DOING, DONE' });
    }

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const hasAccess = await userCanAccessProject(req.user, task.project);
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this project' });
    }

    const isOwner = task.creator.toString() === req.user.id;
    const isAssignee = task.assignedUser && task.assignedUser.toString() === req.user.id;
    const isAdmin = req.user.role === 'ADMIN';

    if (!isOwner && !isAssignee && !isAdmin) {
      return res.status(403).json({ error: 'You do not have permission to move this task' });
    }

    task.status = status;
    await task.save();
    const populated = await task.populate(POPULATE_FIELDS);
    return res.json({ task: populated });
  } catch (err) {
    console.error('updateStatus error:', err);
    return res.status(500).json({ error: 'Failed to update status' });
  }
}

/**
 * PATCH /api/tasks/:id
 * Edit title/description — creator or admin only, and only with current
 * access to the parent project.
 */
async function updateTask(req, res) {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid task id' });

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const hasAccess = await userCanAccessProject(req.user, task.project);
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this project' });
    }

    const isOwner = task.creator.toString() === req.user.id;
    const isAdmin = req.user.role === 'ADMIN';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Only the creator or an admin can edit this task' });
    }

    const { title, description } = req.body;
    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;

    await task.save();
    const populated = await task.populate(POPULATE_FIELDS);
    return res.json({ task: populated });
  } catch (err) {
    console.error('updateTask error:', err);
    return res.status(500).json({ error: 'Failed to update task' });
  }
}

/**
 * DELETE /api/tasks/:id
 * Creator or admin only, and only with current access to the parent
 * project. (Deleting an entire project's tasks in bulk is handled by
 * deleteProject in projectController.js, not this function.)
 */
async function deleteTask(req, res) {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid task id' });

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const hasAccess = await userCanAccessProject(req.user, task.project);
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this project' });
    }

    const isOwner = task.creator.toString() === req.user.id;
    const isAdmin = req.user.role === 'ADMIN';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Only the creator or an admin can delete this task' });
    }

    await task.deleteOne();
    return res.json({ success: true });
  } catch (err) {
    console.error('deleteTask error:', err);
    return res.status(500).json({ error: 'Failed to delete task' });
  }
}

module.exports = { getTasks, createTask, assignTask, updateStatus, updateTask, deleteTask };
