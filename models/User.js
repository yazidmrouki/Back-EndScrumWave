// models/User.js

const mongoose = require('mongoose');

const profileInfoSchema = new mongoose.Schema({
  photo: { type: String, default: '/default-photo.jpg' }, // Photo par défaut
  address: { type: String, default: 'Default Address' }, // Adresse par défaut
  birthday: { type: Date, default: Date.now }, // Date de naissance par défaut
  email: { type: String, default: 'default@example.com' }, // Email par défaut
  description: { type: String, default: 'No description provided' } // Description par défaut
});

const developerSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  prenom: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  type: { type: String, required: true },
  profileInfo: profileInfoSchema
});

// Méthode de pré-enregistrement pour initialiser les valeurs par défaut
developerSchema.pre('save', function(next) {
  // Vérifie si le profil est déjà rempli
  if (!this.profileInfo) {
    this.profileInfo = {}; // Crée un nouveau profil s'il n'existe pas
  }
  next();
});

const Developer = mongoose.model('Developer', developerSchema);

module.exports = Developer;
