// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const Developer = require('../models/User');
const { generateJWTToken } = require('../utils/authUtils');
const { isValidPassword}=require('../utils/Verifier');
const bcrypt = require('bcrypt');
const { LocalStorage } = require('node-localstorage');
const localStorage = new LocalStorage('./scratch');



router.post('/signup', async (req, res) => {
  try {
      // Récupérer les données du corps de la requête
      const { nom, prenom, email, password, type} = req.body;
      const errors = {};

      // Vérifier si l'email est déjà utilisé
      const existingUser = await Developer.findOne({ email });
      if (existingUser) {
          errors.users = 'Cette developpeur existe déjà';
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
     
      if (Object.keys(errors).length > 0) {
          return res.status(400).json({ errors });
      }

      // Hachage du mot de passe
      const hashedPassword = await bcrypt.hash(password, 10);

      // Créer un nouvel utilisateur avec le mot de passe haché
      const newUser = await Developer.create({ nom, prenom, email, password: hashedPassword, type });
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
    // Route pour récupérer les informations d'un développeur par son email
    router.get('/GetInfo', async (req, res) => {
      try {
          // Récupérer l'email du développeur depuis les paramètres de la requête
          const { email } = req.query;
    
          // Rechercher le développeur dans la base de données par son email
          const developer = await Developer.findOne({ email });
    
          // Vérifier si le développeur existe
          if (!developer) {
              return res.status(404).json({ message: 'Développeur introuvable' });
          }
    
          // Retourner les informations du développeur dans la réponse
          res.status(200).json(developer);
      } catch (error) {
          res.status(500).json({ message: error.message });
      }
    });
    router.put('/UpdateInfo', async (req, res) => {
      try {
          // Récupérer l'ID de l'utilisateur et les données mises à jour depuis le corps de la requête
          const { id, nom, prenom, adresse, email, description, phone } = req.body;
  
          // Vérifier si l'ID de l'utilisateur est fourni dans la requête
          if (!id) {
              return res.status(400).json({ message: "ID de l'utilisateur non fourni" });
          }
  
          // Rechercher l'utilisateur dans la base de données par son ID
          let developer = await Developer.findById(id);
  
          // Vérifier si l'utilisateur existe
          if (!developer) {
              return res.status(404).json({ message: "Utilisateur non trouvé" });
          }
  
          // Mettre à jour les informations de l'utilisateur avec les nouvelles données
          developer.nom = nom || developer.nom;
          developer.prenom = prenom || developer.prenom;
          developer.adresse = adresse || developer.adresse;
          developer.email = email || developer.email;
          developer.description = description || developer.description;
          developer.phone = phone || developer.phone;
  
          // Sauvegarder les modifications dans la base de données
          developer = await developer.save();
  
          // Retourner les informations mises à jour de l'utilisateur dans la réponse
          res.status(200).json(developer);
      } catch (error) {
          res.status(500).json({ message: error.message });
      }
  });
  
module.exports = router;
