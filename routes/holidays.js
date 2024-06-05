// routes/holidays.js
const express = require('express');
const router = express.Router();

const Team= require('../models/Teams');

router.get('/get-holidays/:productOwnerId', async (req, res) => {
    try {
        const { productOwnerId } = req.params;

        // Trouver toutes les équipes assignées au ProductOwner spécifique
        const teams = await Team.find({ productOwner: productOwnerId }, 'name holidays');

        // Extraire et formater les vacances avec les noms des équipes
        const holidays = teams.flatMap(team => 
            team.holidays.map(holiday => ({
                ...holiday.toObject(),
                teamId: team._id,
                teamName: team.name
            }))
        );

        res.json(holidays);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

  
  

  router.get('/get-holidays-team/:teamId', async (req, res) => {
    try {
      // Récupérez le teamId de la demande
      const teamId = req.params.teamId;
  
      // Recherchez l'équipe avec le teamId spécifié
      const team = await Team.findById(teamId, 'holidays');
  
      if (!team) {
        return res.status(404).json({ message: 'Team not found' });
      }
  
      // Répondez avec les vacances trouvées pour cette équipe
      res.json(team.holidays);
    } catch (err) {
      // En cas d'erreur, renvoyez un message d'erreur
      res.status(500).json({ message: err.message });
    }
  });
  
module.exports = router;
