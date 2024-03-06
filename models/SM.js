const mongoose = require('mongoose');

// Définition des codes Scrum Master autorisés
const allowedScrumMasterCodes = ['111111', '222222', '333333', '444444'];

const ScrumMasterSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  prenom: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  CodeScrumMaster: { 
    type: String, 
    required: true, 
    validate: {
      validator: function(code) {
        return allowedScrumMasterCodes.includes(code); // Vérifie si le code est présent dans allowedScrumMasterCodes
      },
      message: props => `${props.value} n'est pas un code Scrum Master valide`
    }
  }
});

const ScrumMaster = mongoose.model('ScrumMaster', ScrumMasterSchema);

module.exports = ScrumMaster;
