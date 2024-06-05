const express = require('express');
const mongoose = require('mongoose');
const TeamNotification = require('../models/teamNotification');
const Po = require('../models/Po'); // Assuming the file is named Po.js
const router = express.Router();

// Route to get notifications for a specific team by teamId
router.get('/get-notif-team/:teamId', async (req, res) => {
  const { teamId } = req.params;
  
  try {
    const teamNotifications = await TeamNotification.findOne({ teamId:teamId });
    
    if (!teamNotifications) {
      return res.status(404).json({ message: 'No notifications found for this team' });
    }
    
    res.json(teamNotifications.notifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Route to get notifications for all assigned teams for a PO
router.get('/get-notif-Allteamsassigned/:poId', async (req, res) => {
  const { poId } = req.params;

  try {
    const po = await Po.findById(poId).populate('assignedTeams');
    
    if (!po) {
      return res.status(404).json({ message: 'PO not found' });
    }

    const teamIds = po.assignedTeams.map(team => team._id);
    const teamNotifications = await TeamNotification.find({ teamId: { $in: teamIds } });

    const allNotifications = teamNotifications.reduce((acc, teamNotif) => {
      return acc.concat(teamNotif.notifications);
    }, []);

    res.json(allNotifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
