const mongoose = require('mongoose');
const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

const MEMBER_FIELDS = 'name email';

//GET /api/projects
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

//POST /api/projects
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

//PATCH /api/projects/:id
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


//DELETE /api/projects/:id
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

//POST /api/projects/:id/members
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

//DELETE /api/projects/:id/members/:userId
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
