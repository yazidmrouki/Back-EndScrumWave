const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const ProductOwner = require('../models/Po');
const { generateJWTToken } = require('../utils/authUtils');
const { isValidPassword } = require('../utils/Verifier');
const { LocalStorage } = require('node-localstorage');
const localStorage = new LocalStorage('./scratch');

router.post('/reset-password-email', async (req, res) => {
  const { email, password } = req.body;

  const user = await ProductOwner.findOne({ email });

  if (!user) {
    return res.status(404).send("Email not found");
  }

  // Hacher le nouveau mot de passe
  const hashedPassword = await bcrypt.hash(password, 10);

  // Mettre à jour l'utilisateur avec le nouveau mot de passe
  await user.updateOne({ email }, { password: hashedPassword });

  res.status(200).send("Password reset successfully");
});
router.get('/check-email', async (req, res) => {
  try {
      const { email } = req.query;
      const user = await ProductOwner.findOne({ email });
      res.status(200).json({ exists: !!user });
  } catch (error) {
      res.status(500).json({ message: error.message });
  }
});
router.post('/', async (req, res) => {
    try {
      const { nom, prenom, email, password, code } = req.body;
  
      const existingUser = await ProductOwner.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'Cet ProductOwner existe déjà' });
      }
  
      const hashedPassword = await bcrypt.hash(password, 10);
  
      const newUser = await ProductOwner.create({ nom, prenom, email, password: hashedPassword, CodePo });
  
      res.status(201).json(newUser);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  

  
  router.post('/signup', async (req, res) => {
    try {
        // Récupérer les données du corps de la requête
        const { nom, prenom, email, password, code } = req.body;
        const errors = {};

        // Vérifier si l'email est déjà utilisé
        const existingUser = await ProductOwner.findOne({ email });
        if (existingUser) {
            errors.users = 'Cet Po existe déjà';
        }

        // Validation du nom et du prénom
        const nameRegex = /^[a-zA-Z]+$/;
        if (!nameRegex.test(nom)) {
            errors.nom = 'Le nom ne doit contenir que des lettres';
        }
        if (!nameRegex.test(prenom)) {
            errors.prenom = 'Le prénom ne doit contenir que des lettres';
        }

        // Vérification de l'e-mail
        const emailContainsVermeg = /@Vermeg/.test(email);
        if (!emailContainsVermeg) {
            errors.email = 'L\'adresse e-mail doit appartenir à l\'entreprise Vermeg';
        }

        // Vérification de la force du mot de passe
        const containsUpperCase = /[A-Z]/.test(password);
        const containsNumberOrSpecialChar = /[0-9!@#$%^&*(),.?":{}|<>]/.test(password);
        const isOfSufficientLength = password.length >= 8;

        if (!containsUpperCase || !containsNumberOrSpecialChar || !isOfSufficientLength) {
            errors.password = 'Le mot de passe doit contenir au moins une lettre majuscule, un chiffre, un caractère spécial et être d\'au moins 8 caractères de longueur';
        }

        // Vérification du code
        const authorizedCodes = ['111111', '222222', '333333', '444444'];
        if (!authorizedCodes.includes(code)) {
            errors.code = 'Le code saisi n\'est pas Une IdentifiantProductOWner';
        }

        if (Object.keys(errors).length > 0) {
            return res.status(400).json({ errors });
        }

        // Hachage du mot de passe
        const hashedPassword = await bcrypt.hash(password, 10);

        // Créer un nouvel utilisateur avec le mot de passe haché
        const newUser = await ProductOwner.create({ nom, prenom, email, password: hashedPassword, CodePo: code });
  res.status(201).json(newUser);
    } catch (error) {
        // Gérer les erreurs spécifiques
        if (error.name === 'ValidationError') {
            // Si une validation échoue, renvoyer une réponse 400 (Bad Request) avec les détails des erreurs de validation
            return res.status(400).json({ errors: error.errors });
        } else {
            // Si une erreur inattendue se produit, renvoyer une réponse 500 (Internal Server Error) avec un message générique
            console.error("Erreur lors de la création du compte :", error);
            return res.status(500).json({ message: 'Une erreur est survenue lors de la création du compte' });
        }
    }
});
    

  
router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await ProductOwner.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    if (!user.password) {
      return res.status(500).json({ message: 'Erreur interne du serveur' });
    }

    const isPasswordValid = await isValidPassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    const token = generateJWTToken(user);
    localStorage.setItem('token', token);

    res.status(200).json({ token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
