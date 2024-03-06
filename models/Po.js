const mongoose = require('mongoose');

// Définition des codes PO autorisés
const allowedCodes = ['123456', '654321', '852741', '963852'];

const PoSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  prenom: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  CodePo: { 
    type: String, 
    required: true, 
    validate: {
      validator: function(code) {
        return allowedCodes.includes(code); // Vérifie si le code est présent dans allowedCodes
      },
      message: props => `${props.value} n'est pas un code PO valide`
    }
  }
});

const ProductOwner = mongoose.model('ProductOwner', PoSchema);

module.exports = ProductOwner;
