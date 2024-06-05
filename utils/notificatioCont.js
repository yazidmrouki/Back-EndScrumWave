const TeamNotification = require('../models/teamNotification');
const Team = require('../models/Teams');

async function saveTeamNotification(teamId, emailActor, nameActor, actionType, actorType) {
    try {
        if (!teamId) {
            console.error('Team ID is null or undefined');
            return;
        }

        const team = await Team.findById(teamId);
        if (!team) {
            console.error(`Team with ID ${teamId} not found`);
            return;
        }

        const notification = {
            emailActor,
            nameActor,
            actionType,
            actorType,
            date: new Date()
        };

        // Rechercher une collection de notifications pour cette équipe
        let teamNotification = await TeamNotification.findOne({ teamId: teamId });

        if (!teamNotification) {
            // Si aucune collection n'existe pour cette équipe, en créer une nouvelle
            teamNotification = new TeamNotification({
                teamId: teamId,
                notifications: [notification]
            });
        } else {
            // Ajouter la nouvelle notification à la collection existante
            teamNotification.notifications.push(notification);
        }

        await teamNotification.save();
        console.log(`Notification enregistrée pour l'équipe avec l'ID ${teamId}.`);
    } catch (error) {
        console.error("Une erreur s'est produite lors de l'enregistrement de la notification pour l'équipe :", error);
        throw error;
    }
}

async function saveNotificationForProductOwner(poId, emailActor, nameActor, actionType, actorType) {
    try {
        const teams = await Team.find({ productOwner: poId });
        if (teams.length === 0) {
            console.error(`Aucune équipe trouvée pour le Product Owner avec l'ID ${poId}`);
            return;
        }

        for (const team of teams) {
            await saveTeamNotification(team._id, emailActor, nameActor, actionType, actorType);
        }
    } catch (error) {
        console.error("Une erreur s'est produite lors de l'enregistrement des notifications pour le Product Owner :", error);
        throw error;
    }
}

async function deleteNotificationsForTeam(teamId) {
    try {
        await TeamNotification.deleteOne({ teamId: teamId });
        console.log(`Notifications supprimées pour l'équipe avec l'ID ${teamId}.`);
    } catch (error) {
        console.error("Une erreur s'est produite lors de la suppression des notifications pour l'équipe :", error);
        throw error;
    }
}

module.exports = {
    saveTeamNotification,
    deleteNotificationsForTeam,
    saveNotificationForProductOwner
};
