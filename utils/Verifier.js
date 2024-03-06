// verifier.js

const bcrypt = require('bcrypt');

// Fonction pour vérifier si le mot de passe est valide
function isValidPassword(password, hashedPassword) {
  // Générer un jeton JWT avec l'identifiant de l'utilisateur
  return bcrypt.compare(password, hashedPassword);
  
}

module.exports = { isValidPassword };
