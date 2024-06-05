const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  emailActor: { type: String, required: true },
  nameActor: { type: String, required: true },
  
  actionType: { type: String, required: true },
  actorType: { type: String, required: true },
  date: { type: Date, default: Date.now }
});

const teamNotificationSchema = new mongoose.Schema({
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  notifications: [notificationSchema]
});

const TeamNotification = mongoose.model('TeamNotification', teamNotificationSchema);

module.exports = TeamNotification;
