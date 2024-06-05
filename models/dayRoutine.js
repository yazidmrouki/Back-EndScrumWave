// dayRoutine.js

const mongoose = require('mongoose');

const dayRoutineSchema = new mongoose.Schema({
    jour: { type: String, required: true }, // Modifier le champ "date" en "jour"
    punchinTime: { type: String, required: true },
    punchoutTime: { type: String, required: true },
    breackTime: { type: String, required: true },
    halfDay: { type: Boolean, default: false },
    fullDay: { type: Boolean, default: false },
    overTime: { type: String, required: true },
    total: { type: String, required: true }
  });

const DayRoutine = mongoose.model('DayRoutine', dayRoutineSchema);

module.exports = DayRoutine;
