const mongoose = require('mongoose');

// Schéma pour les outputs
const outputSchema = new mongoose.Schema({
  nameOutput: { type: String },
  description: { type: String },
  outputCapture: { type: String }
});

// Schéma pour les tickets
const ticketSchema = new mongoose.Schema({
  typeTicket: {
    type: String,
    required: true
  },
  emailDeveloppeur: {
    type: String,
    required: true
  },
  outputs: [outputSchema],
  priority: {
    type: String,
    required: true
  },
  ticketInfo: {
    type: String,
    required: true
  },
  dateCreation: {
    type: Date,
    default: Date.now
  },
  bug: {
    type: Boolean,
    default: false
  },
  bugDetails: {
    type: {
      type: String,
      enum: ['technical', 'non-technical'],
      required: function() { return this.bug; }
    },
    description: {
      type: String,
      required: function() { return this.bug; }
    },
    screenshot: {
      type: String
    }
  },
  noSprint: {
    type: Number
  },
  numTicket: {
    type: Number
  },
  ticketState: {
    type: String,
    enum: ['To Do', 'In Progress', 'Completed'],
    default: 'To Do'
  }
});

const dailyScrumSchema = new mongoose.Schema({
  dailyUrl: {
    type: String,
    default: null
  },
  dailyProgram: {
    type: Date,
    required: true
  },
  added: {
    type: Boolean,
    default: false // Par défaut, l'URL n'est pas ajoutée
  },
  annuler: {
    type: Boolean,
    default: false // Par défaut, le Daily Scrum n'est pas annulé
  }
});

// Schéma pour les projets
const projectSchema = new mongoose.Schema({
  projectName: {
    type: String,
    required: true
  },
  projectCategory: {
    type: String,
    required: true
  },
  userStories: [{
    type: String,
    default: '1.jpg',
    required: true // Array of URLs for User Stories
  }],
  productBacklog: [{
    type: String,
    default: '1.jpg',
    required: true // Array of URLs for Product Backlog
  }],
  projectStartDate: {
    type: Date,
    required: true
  },
  projectEndDate: {
    type: Date,
    required: true
  },
  projectAssignedTeams: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team'
  },
  budget: {
    type: Number,
    required: true
  },
  priority: {
    type: String,
    required: true
  },
  description: String,
  emailPo: {
    type: String,
    required: true
  },
  recentActivities: [{
    nameActor: {
      type: String,
      required: true
    },
   
    email: {
      type: String,
      required: true
    },
    actionInfo: {
      type: String,
      required: true
    },
    date: {
      type: Date,
      default: Date.now
    }
  }],
  sprints: [{
    sprintNumber: {
      type: Number,
      required: true
    },
    sprintName: {
      type: String,
      required: true
    },
    sprintStartDate: {
      type: Date,
      required: true
    },
    sprintEndDate: {
      type: Date,
      required: true
    },
    tickets: [ticketSchema] // Liste intégrée de tickets pour ce sprint
  }],
  dailyScrums: [dailyScrumSchema] ,
  ClientName:{
    type: String,
    required: true
  },
Delivered:{
    type: Boolean ,
    required: true
  },
  
  
  // Ajout du champ dailyScrums pour les réunions quotidiennes
});

ticketSchema.virtual('formattedDateCreation').get(function() {
  return this.dateCreation.toISOString().split('T')[0];
});

// Convertit la date de début de projet au format 'yyyy/mm/jj'
projectSchema.virtual('formattedProjectStartDate').get(function() {
  return this.projectStartDate.toISOString().split('T')[0];
});

// Convertit la date de fin de projet au format 'yyyy/mm/jj'
projectSchema.virtual('formattedProjectEndDate').get(function() {
  return this.projectEndDate.toISOString().split('T')[0];
});

// Méthode pour supprimer les tickets par email
projectSchema.methods.deleteTicketsByEmail = async function(email) {
  try {
    for (const sprint of this.sprints) {
      for (const ticket of sprint.tickets) {
        if (ticket.emailDeveloppeur === email) {
          await Project.updateOne(
            { _id: this._id, "sprints.tickets._id": ticket._id },
            { $pull: { "sprints.$.tickets": { _id: ticket._id } } }
          );
        }
      }
    }
    console.log(`Tickets for developer with email ${email} deleted successfully.`);
  } catch (error) {
    console.error('Error deleting tickets:', error);
    throw error;
  }
};

// Méthode pour calculer l'avancement du projet
projectSchema.methods.calculateProjectProgress = function() {
  let completedCount = 0;
  let totalTickets = 0;

  this.sprints.forEach(sprint => {
    sprint.tickets.forEach(ticket => {
      totalTickets++;
      if (ticket.ticketState === 'Completed') {
        completedCount++;
      }
    });
  });

  return totalTickets > 0 ? (completedCount * 100 / totalTickets) : 0;
};

// Hook Mongoose pour attribuer automatiquement le numéro de sprint au champ noSprint lors de la création d'un ticket
projectSchema.pre('save', function (next) {
  const project = this;
  project.sprints.forEach(sprint => {
    sprint.tickets.forEach(ticket => {
      ticket.noSprint = sprint.sprintNumber;
    });
  });
  next();
});

// Hook pour vérifier et supprimer le projet s'il n'a pas d'équipe assignée
projectSchema.pre('remove', async function (next) {
  if (!this.projectAssignedTeams) {
    try {
      await this.remove();
      console.log(`Project ${this.projectName} removed.`);
    } catch (error) {
      console.error("Error removing project:", error);
      throw error;
    }
  }
  next();
});

// Middleware pour enregistrer les activités récentes
projectSchema.methods.addRecentActivity = async function(nameActor, email, actionInfo) {
  try {
    this.recentActivities.push({ nameActor, email, actionInfo });
    await this.save();
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement de l\'activité récente :', error);
    throw error;
  }
};

// Hook pour assigner un numéro de ticket avant de sauvegarder le projet
projectSchema.pre('save', function (next) {
  const project = this;
  project.sprints.forEach(sprint => {
    sprint.tickets.forEach((ticket, index) => {
      ticket.numTicket = index + 1;
    });
  });
  next();
});

projectSchema.statics.updateDelayedDailyScrums = async function() {
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes en millisecondes

  try {
    console.log('Starting update for delayed Daily Scrums...');
    console.log(`Current time: ${now.toISOString()}`);
    console.log(`Checking for Daily Scrums delayed before: ${fiveMinutesAgo.toISOString()}`);

    const projects = await this.find({});
    console.log(`Found ${projects.length} projects`);

    for (const project of projects) {
      console.log(`Checking project: ${project.projectName}`);
      let projectUpdated = false;

      for (const dailyScrum of project.dailyScrums) {
        console.log(`Checking Daily Scrum scheduled for: ${dailyScrum.dailyProgram}`);
        console.log(`Added: ${dailyScrum.added}, Annuler: ${dailyScrum.annuler}`);

        if (dailyScrum.dailyProgram <= fiveMinutesAgo && !dailyScrum.added) {
          console.log(`Daily Scrum delayed, updating...`);
          
          dailyScrum.annuler = true;
          projectUpdated = true;
        }
      }

      if (projectUpdated) {
        await project.save();
        console.log(`Updated Daily Scrums for project: ${project.projectName}`);
      }
    }

    console.log('Update of delayed Daily Scrums complete');
  } catch (error) {
    console.error('Error during update of delayed Daily Scrums:', error);
    throw error;
  }
};





const Project = mongoose.model('Project', projectSchema);

module.exports = Project;
