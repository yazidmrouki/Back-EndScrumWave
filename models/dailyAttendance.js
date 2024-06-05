const mongoose = require('mongoose');

const dailyAttendanceSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  dateConnected: { type: Date, default: null },
  dateDisconnected: { type: Date, default: null },
  hoursConnected: { type: Number, default: 0 },
  isConnected: { type: Boolean, default: false } // Vous pouvez initialiser isConnected à false
});

const attendanceSchema = new mongoose.Schema({
  developer: { type: mongoose.Schema.Types.ObjectId, ref: 'Developer' },
  attendanceData: [dailyAttendanceSchema] // Utilisation d'un tableau pour stocker les données de présence pour chaque jour
});

const Attendance = mongoose.model('Attendance', attendanceSchema);

module.exports = Attendance;
