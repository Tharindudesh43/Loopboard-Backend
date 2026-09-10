const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // A normal user must appear here to see this project or act on its
    // tasks. Admins bypass this check entirely (see requireAdmin usage
    // and the admin-role short-circuit in projectController/taskController).
    // Removing a user from this array only hides the project from them —
    // it never touches their existing tasks, which stay attached to the
    // project for every other member and reappear if access is re-granted.
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Project', projectSchema);
