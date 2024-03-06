// authUtils.js
const jwt = require('jsonwebtoken');

function generateJWTToken(user) {
  // Générer un jeton JWT avec l'identifiant de l'utilisateur
  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  return token;
}

module.exports = { generateJWTToken };
