const mongoose = require('mongoose');
const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

const MEMBER_FIELDS = 'name email';

/**
 * GET /api/projects
 * Admin sees every project (so they can manage access on any of them).
 * A normal user sees only projects where they currently appear in
 * `members` — this is the single point that makes a revoked project
 * "disappear" for that user without touching any data.
 */
async function listProjects(req, res) {
  try {
    const filter = req.user.role === 'ADMIN' ? {} : { members: req.user.id };

    const projects = await Project.find(filter)
      .populate('createdBy', MEMBER_FIELDS)
      .populate('members', MEMBER_FIELDS)
      .sort({ createdAt: -1 });

    return res.json({ projects });
  } catch (err) {
    console.error('listProjects error:', err);
    return res.status(500).json({ error: 'Failed to load projects' });
  }
}

/**
 * POST /api/projects
 * Admin-only. Starts with no members — admin grants access afterward.
 */
async function createProject(req, res) {
  try {
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const project = await Project.create({
      name: name.trim(),
      description: description || '',
      createdBy: req.user.id,
      members: [],
    });

    await project.populate('createdBy', MEMBER_FIELDS);
    return res.status(201).json({ project });
  } catch (err) {
    console.error('createProject error:', err);
    return res.status(500).json({ error: 'Failed to create project' });
  }
}

/**
 * PATCH /api/projects/:id
 * Admin-only. Edits name/description only — membership changes go
 * through the dedicated add/remove-member endpoints below.
 */
async function updateProject(req, res) {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ error: 'Invalid project id' });
    }

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const { name, description } = req.body;
    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ error: 'Project name cannot be empty' });
      }
      project.name = name.trim();
    }
    if (description !== undefined) {
      project.description = description;
    }

    await project.save();
    await project.populate('createdBy', MEMBER_FIELDS);
    await project.populate('members', MEMBER_FIELDS);
    return res.json({ project });
  } catch (err) {
    console.error('updateProject error:', err);
    return res.status(500).json({ error: 'Failed to update project' });
  }
}

/**
 * DELETE /api/projects/:id
 * Admin-only. Deletes every task under this project first, then the
 * project itself — this is the one operation in the whole system that
 * actually destroys task history, by design (per the spec: project
 * deletion removes its tasks for everyone; access revocation does not).
 */
async function deleteProject(req, res) {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ error: 'Invalid project id' });
    }

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await Task.deleteMany({ project: project._id });
    await project.deleteOne();

    return res.json({ success: true });
  } catch (err) {
    console.error('deleteProject error:', err);
    return res.status(500).json({ error: 'Failed to delete project' });
  }
}

/**
 * POST /api/projects/:id/members
 * Admin-only. Grants a user access. Body: { userId }.
 */
async function addMember(req, res) {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!isValidId(id)) {
      return res.status(400).json({ error: 'Invalid project id' });
    }
    if (!userId || !isValidId(userId)) {
      return res.status(400).json({ error: 'A valid userId is required' });
    }

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const alreadyMember = project.members.some((m) => m.toString() === userId);
    if (!alreadyMember) {
      project.members.push(userId);
      await project.save();
    }

    await project.populate('createdBy', MEMBER_FIELDS);
    await project.populate('members', MEMBER_FIELDS);
    return res.json({ project });
  } catch (err) {
    console.error('addMember error:', err);
    return res.status(500).json({ error: 'Failed to grant project access' });
  }
}

/**
 * DELETE /api/projects/:id/members/:userId
 * Admin-only. Revokes access. Deliberately does NOT touch any Task
 * documents — this is what keeps task history intact if the user is
 * re-added later.
 */
async function removeMember(req, res) {
  try {
    const { id, userId } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({ error: 'Invalid project id' });
    }
    if (!isValidId(userId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    project.members = project.members.filter((m) => m.toString() !== userId);
    await project.save();

    await project.populate('createdBy', MEMBER_FIELDS);
    await project.populate('members', MEMBER_FIELDS);
    return res.json({ project });
  } catch (err) {
    console.error('removeMember error:', err);
    return res.status(500).json({ error: 'Failed to revoke project access' });
  }
}

module.exports = {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  addMember,
  removeMember,
};
