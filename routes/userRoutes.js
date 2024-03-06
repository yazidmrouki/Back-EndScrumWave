// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const Developer = require('../models/User');
const { generateJWTToken } = require('../utils/authUtils');
const { isValidPassword}=require('../utils/Verifier');
const bcrypt = require('bcrypt');
const { LocalStorage } = require('node-localstorage');
const localStorage = new LocalStorage('./scratch');
const passwordStrength = require('password-strength');

router.post('/signup', async (req, res) => {
  try {
    // Récupérer les données du corps de la requête
    const { nom, prenom, email, password, type } = req.body;

    // Vérifier si l'email est déjà utilisé
    const existingUser = await Developer.findOne({ email });
    const strength = passwordStrength(password).value;
    if (existingUser||strength > 0.9) {
      return res.status(400).json({ message: 'Cet utilisateur existe déjà' });
    }

    // Vérifier la force du mot de passe
    

    // Si le mot de passe est faible, renvoyer une réponse d'erreur
   
      // Hachage du mot de passe
      const hashedPassword = await bcrypt.hash(password, 10);

      // Créer un nouvel utilisateur avec le mot de passe haché
      const newUser = await Developer.create({ nom, prenom, email, password: hashedPassword, type });

      res.status(201).json(newUser);
    
  } catch (error) {
    // Gérer les erreurs
    if (error.name === 'ValidationError') {
      // Erreur de validation, des champs obligatoires manquants par exemple
      const errors = Object.values(error.errors).map(error => error.message);
      return res.status(400).json({ message: errors.join(', ') });
    } else {
      // Autre erreur interne du serveur
      console.error("Erreur lors de la création du compte :", error);
      res.status(500).json({ message: 'Une erreur est survenue lors de la création du compte' });
    }
  }
});

router.get('/check-email', async (req, res) => {
    try {
        const { email } = req.query;
        const user = await Developer.findOne({ email });
        res.status(200).json({ exists: !!user });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Route pour créer un développeurl
router.post('/', async (req, res) => {
  try {
    const newDeveloper = await Developer.create(req.body);
    res.status(201).json(newDeveloper);
  } catch (error) {
    res.status(500).json({ message: error.message });
  } 
});



router.post('/reset-password-email', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Vérifier si l'utilisateur existe dans la base de données
    const user = await Developer.findOne({ email });

    if (!user) {
      return res.status(404).send("Email not found");
    }

    // Hacher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Mettre à jour l'utilisateur avec le nouveau mot de passe
    await Developer.updateOne({ email }, { password: hashedPassword });

    res.status(200).send("Password reset successfully");
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).send("Internal server error");
  }
});

// routes/userRoutes.js

  // routes/userRoutes.js
router.post('/signin', async (req, res) => {
    try {
      // Récupérer les données d'identification du corps de la requête
      const { email, password } = req.body;
  
      // Vérifier si l'utilisateur existe dans la base de données
      const user = await Developer.findOne({ email });
      if (!user) {
        return res.status(401).json({ message: 'Email introuvable' });
      }
      
      // Vérifier si user.password est défini
      if (!user.password) {
        return res.status(500).json({ message: 'Erreur interne du serveur' });
      }
      
     
  
      // Vérifier si le mot de passe est correct
      const isPasswordValid = await isValidPassword(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'mot de passe incorrect' });
      }
  
      // Générer un jeton JWT pour l'utilisateur
      const token = generateJWTToken(user);
      localStorage.setItem('token', token);
      console.log(localStorage.getItem("token"));

      res.status(200).json({ token });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  
module.exports = router;
