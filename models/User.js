// models/User.js
const mongoose = require('mongoose');

const developerSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  prenom: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  type: { type: String,required: true },
});

const Developer = mongoose.model('Developer', developerSchema);

module.exports = Developer;
