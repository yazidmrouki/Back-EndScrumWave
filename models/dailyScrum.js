const mongoose = require('mongoose');

// Définition du schéma
const DailyScrumSchema = new mongoose.Schema({
    teamId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team', // Référence à un modèle d'équipe
        required: true
    },
    startTime: {
        type: Date,
        default: null // Valeur par défaut pour startTime
    },
    meetingLink: {
        type: String,
        default: null // Valeur par défaut pour meetingLink
    },
    ProjectAssigned: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Projet', // Référence à un modèle d'équipe
        required: true
    }
   
});

// Méthode statique pour créer un DailyScrum avec des valeurs par défaut par teamId
DailyScrumSchema.statics.createWithDefaultsByTeamId = async function(teamId, projectId) {
    const dailyScrum = new this({
        teamId,
        startTime: new Date(), // Assigner la date actuelle ou une autre valeur par défaut valide
        meetingLink: 'http://defaultlink.com', // Assigner un lien par défaut valide
        ProjectAssigned: projectId
    });
    return dailyScrum.save();
};

// Méthode statique pour supprimer un DailyScrum par projectId
DailyScrumSchema.statics.deleteByProjectId = async function(projectId) {
    return this.findOneAndDelete({ ProjectAssigned: projectId });
};

// Création du modèle à partir du schéma
const DailyScrum = mongoose.model('DailyScrum', DailyScrumSchema);

module.exports = DailyScrum;
