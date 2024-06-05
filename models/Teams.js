const mongoose = require('mongoose');
const holidaySchema = new mongoose.Schema({
  name: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
 
});

const teamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  developer: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Developer' }],
  scrumMaster: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ScrumMaster',
    required: true,
    autopopulate: true
  },
  projects: [{
    projectName: { type: String, required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true }
  }],
  holidays: [holidaySchema],
  totalProjects: { type: Number, default: 0 },
  productOwner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductOwner',
    required: true,
    autopopulate: true
  },
  numberOfMembers: { type: Number, default: 0 },
  creationDate: { type: Date, default: Date.now },
  workType: { type: String, default: 'Web' }
});
teamSchema.pre('save', async function(next) {
  // Calculer le nombre total de projets dans la liste des projets de l'équipe
  this.totalProjects = this.projects.length;
  next();
});

const Team = mongoose.model('Team', teamSchema);

module.exports = Team;
