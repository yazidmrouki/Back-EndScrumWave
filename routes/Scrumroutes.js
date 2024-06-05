const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const ScrumMaster = require('../models/SM');
const { generateJWTToken } = require('../utils/authUtils');
const { isValidPassword } = require('../utils/Verifier');
const { LocalStorage } = require('node-localstorage');
const localStorage = new LocalStorage('./scratch');
const multer = require('multer');
const { handleSignIn, handleSignOut }= require('../utils/attendanceController');
const fs = require('fs');
const path = require('path');
const Project=require("../models/Projet");
const Developer = require("../models/User");
const Team = require("../models/Teams");

const ProductOwner = require("../models/Po");
const teamNotificationController = require('../utils/notificatioCont');

router.post('/reset-password-email', async (req, res) => {
    const { email, password } = req.body;
    const errors = {};
    try {


 
      // Vérification de la force du mot de passe
      const containsUpperCase = /[A-Z]+/.test(password);
      const containsNumber = /[0-9]+/.test(password);
      const containsSpecialChar = /[!@#$%^&*(),.?":{}|<>]+/.test(password);
      const isOfSufficientLength = password.length >= 8;
  
      if (!containsUpperCase || !containsNumber || !containsSpecialChar || !isOfSufficientLength) {
        errors.password = 'Le mot de passe doit contenir au moins une lettre majuscule, un chiffre, un caractère spécial et être d\'au moins 8 caractères de longueur';
        return res.status(400).json({ error: "Le mot de passe doit contenir au moins une lettre majuscule, un chiffre, un caractère spécial et être d'au moins 8 caractères de longueur" });
      }
  
      if (Object.keys(errors).length > 0) {
        return res.status(400).json({ errors });
    }
      // Hacher le nouveau mot de passe
      const hashedPassword = await bcrypt.hash(password, 10);
  
      // Mettre à jour l'utilisateur avec le nouveau mot de passe
      await ScrumMaster.findOneAndUpdate({ email }, { password: hashedPassword });
  

      res.status(200).send("Réinitialisation du mot de passe réussie");
    } catch (error) {
      console.error("Erreur lors de la réinitialisation du mot de passe:", error);
      res.status(500).send("Erreur interne du serveur");
    }
});



router.get('/check-email', async (req, res) => {
    try {
        const { email } = req.query;
        const user = await ScrumMaster.findOne({ email });
        res.status(200).json({ exists: !!user });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
  });
// Route pour créer un ScrumMaster
router.post('/', async (req, res) => {
    try {
        const { nom, prenom, email, password, code } = req.body;

        const existingUser = await ScrumMaster.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Cet ScrumMaster existe déjà' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newScrumMaster = await ScrumMaster.create({ nom, prenom, email, password: hashedPassword, code });

        res.status(201).json(newScrumMaster);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Route pour l'inscription d'un ScrumMaster
   router.post('/signup', async (req, res) => {
    try {
        // Récupérer les données du corps de la requête
        const { nom, prenom, email, password, code } = req.body;
        const errors = {};

        // Vérifier si l'email est déjà utilisé
        const existingUser = await ScrumMaster.findOne({ email });
        if (existingUser) {
            errors.users = 'Cet Sm  existe déjà';
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
            errors.code = 'Le code saisi n\'est pas une Identifiant Scrummaster';
        }

        if (Object.keys(errors).length > 0) {
            return res.status(400).json({ errors });
        }

        // Hachage du mot de passe
        const hashedPassword = await bcrypt.hash(password, 10);

        // Créer un nouvel utilisateur avec le mot de passe haché
        const newUser = await ScrumMaster.create({ nom, prenom, email, password: hashedPassword, CodeScrumMaster: code });
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
    
// Route pour la connexion d'un ScrumMaster
router.post('/signin', async (req, res) => {
  try {
      const { email, password } = req.body;
      
  
      const user = await ScrumMaster.findOne({ email });
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

      await handleSignIn(user._id,"Scrum Master");
      
      const Assignedteam=user.assignedTeams;
      const name=user.nom+" "+user.prenom;
      const id=user._id;
      await teamNotificationController.saveTeamNotification(Assignedteam, email, name,  " a Connecté","scrumMasters");
     
      res.status(200).json({ token,id,Assignedteam,name,email});
  } catch (error) {
      res.status(500).json({ message: error.message });
  }
});
/// Route pour récupérer l'état de connexion d'un développeur
router.get('/isConnected/:UserId', async (req, res) => {
  try {
    const UserId = req.params.UserId;
    const isConnected = await getIsConnected(UserId);
    res.json({ isConnected });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur du serveur' });
  }
});
// Route pour gérer la déconnexion de l'employé
router.post('/signout', async (req, res) => {
  try {
    const { developerId } = req.body;
    
    // Récupérer le développeur à partir de l'ID
    const developer = await ScrumMaster.findById(developerId);
    
    if (!developer) {
      return res.status(404).json({ message: 'Développeur non trouvé' });
    }
    
    // Extraire l'email et le nom du développeur
    const { email, nom ,assignedTeams } = developer;
    
    // Exécuter la fonction de déconnexion
    await handleSignOut(developerId, "Scrum Master");
    
    // Enregistrer la notification de déconnexion pour l'équipe
    await teamNotificationController.saveTeamNotification(assignedTeams, email, nom, "Déconnecté", "scrumMasters");
    
    // Répondre avec un succès
    res.status(200).json({ message: 'Déconnexion réussie' });
  } catch (error) {
    // Si une erreur se produit, répondre avec une erreur serveur
    res.status(500).json({ message: error.message });
  }
});

 // Route pour récupérer les informations d'un développeur par son email
 router.get('/GetInfo', async (req, res) => {
    try {
        // Récupérer l'email du développeur depuis les paramètres de la requête
        const { email } = req.query;
  
        // Rechercher le développeur dans la base de données par son email
        const newUser = await ScrumMaster.findOne({ email });
  
        // Vérifier si le développeur existe
        if (!newUser) {
            return res.status(404).json({ message: 'Développeur introuvable' });
        }
  
        // Retourner les informations du développeur dans la réponse
        res.status(200).json(newUser);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
  });
  router.put('/UpdateInfo/:email', async (req, res) => {
    try {
      const { email } = req.params;
        const { nom, prenom, adresse, description, phone, birthday } = req.body;
  
        // Rechercher l'utilisateur par e-mail
        const newUser= await ScrumMaster.findOne({ email });
  
        if (!newUser) {
            return res.status(404).json({ message: "Utilisateur non trouvé" });
        }
  
        // Mettre à jour les informations du profil avec les données fournies
        newUser.nom = nom || newUser.nom;
        newUser.prenom = prenom || newUser.prenom;
        newUser.profileInfo.birthday = birthday || newUser.profileInfo.birthday;
        newUser.profileInfo.description = description || newUser.profileInfo.description;
        newUser.phone = phone || newUser.phone;
        newUser.profileInfo. address = adresse || newUser.profileInfo.address;
  
        // Sauvegarder les modifications dans la base de données
        await newUser.save();
  
        // Répondre avec les informations mises à jour
        res.status(200).json({ message: "Profil mis à jour avec succès", newUser });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
  });
    


  router.get('/my-team/:developerId', async (req, res) => {
    try {
      const developerId = req.params.developerId;
  
      // Trouver l'équipe à laquelle le développeur est associé
      const team = await Team.findOne({ scrumMaster: developerId });
      if (!team) {
        return res.status(404).json({ message: "Équipe non trouvée pour cet ID de développeur." });
      }
  
      // Récupérer les membres de l'équipe (développeurs, scrum masters, product owners)
      const developers = await Developer.find({ _id: { $in: team.developer } });
      const scrumMasters = await ScrumMaster.find({ _id: team.scrumMaster });
      const productOwners = await ProductOwner.find({ _id: team.productOwner });
  
      // Envoyer les membres de l'équipe en réponse
      res.status(200).json({ developers, scrumMasters, productOwners, team });
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'équipe :', error);
      res.status(500).json({ message: 'Une erreur est survenue lors de la récupération de l\'équipe.' });
    }
  });

  
// Configuration du stockage Multer pour les photos de profil
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, './assets');
    },
    filename: function (req, file, cb) {
      cb(null, file.fieldname + "_" + Date.now() + path.extname(file.originalname));
    }
  });
  
  // Configuration de l'upload avec Multer
  const uploadd = multer({ storage: storage });
  
  // Route pour mettre à jour la photo de profil de l'utilisateur
  router.post('/update-profile-photo', uploadd.single('photo'), async (req, res) => {
    try {
      const { email } = req.body;
  
      // Rechercher l'utilisateur par e-mail
      const SCM = await ScrumMaster.findOne({ email });
  
      if (!SCM) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }
  
      // Vérifier si une nouvelle photo a été téléchargée
      if (!req.file) {
        return res.status(400).json({ message: "Aucune photo téléchargée" });
      }
  
      // Mettre à jour les informations de la photo de profil
       // Mettre à jour le chemin de la photo de profil dans le document de l'utilisateur
       SCM.profileInfo.photo = req.file.filename;
  
       await teamNotificationController.saveTeamNotification(SCM.assignedTeams, SCM.email, SCM.nom, "à Changer le photo de profile ", "scrumMasters");
    
      // Sauvegarder les modifications dans la base de données
      await SCM.save();
  
      // Répondre avec un message de succès
      res.status(200).json({ message: "Photo de profil mise à jour avec succès",photoPath: req.file.filename });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Route pour récupérer la photo de profil de l'utilisateur
  router.get('/get-profile-photo/:email', async (req, res) => {
    try {
      const { email } = req.params; // Utiliser req.query pour récupérer les paramètres de requête
      const SCM = await ScrumMaster.findOne({ email });
  
      if (!SCM || !SCM.profileInfo.photo) {
        return res.status(404).json({ message: "Photo de profil non trouvée" });
      }
  
      // Construire le chemin absolu vers le fichier image
      const imagePath = path.join(__dirname, '..', 'assets', SCM.profileInfo.photo);
  
      // Vérifier si le fichier existe
      if (!fs.existsSync(imagePath)) {
        return res.status(404).json({ message: "Photo de profil non trouvée" });
      }
  
      // Lire le contenu du fichier image
      const imageContent = fs.readFileSync(imagePath);
  
      // Définir le type de contenu sur 'image/jpeg' ou 'image/png' selon le format de l'image
      res.set('Content-Type', 'image/jpeg');
  
      // Envoyer le contenu de l'image en réponse
      res.send(imageContent);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  // routes/userRoutes.js
  
  
  
  // Ajouter une route pour ajouter une nouvelle expérience
  router.post('/add-experience', async (req, res) => {
    try {
      // Récupérer l'e-mail du développeur depuis le corps de la requête
      const { email } = req.body;
  
      // Récupérer les données de la nouvelle expérience depuis le corps de la requête
      const { title, company, startDate, endDate, description } = req.body;
  
      // Vérifier si le développeur existe dans la base de données
      const SCM = await ScrumMaster.findOne({ email });
      if (!SCM) {
        return res.status(404).json({ message: 'ScrumMAster non trouvé' });
      }
  
      // Créer un nouvel objet d'expérience avec les données fournies
      const newExperience = {
        title,
        company,
        startDate,
        endDate,
        description
      };
  
      // Ajouter la nouvelle expérience à la liste des expériences du développeur
      SCM.experiences.push(newExperience);
  
      // Sauvegarder les modifications dans la base de données
      await SCM.save();
  
      // Répondre avec un message de succès et les données de la nouvelle expérience
      res.status(201).json({ message: 'Nouvelle expérience ajoutée avec succès', newExperience });
    } catch (error) {
      // Gérer les erreurs
      res.status(500).json({ message: error.message });
    }
  });
  
  router.post('/get-experiences', async (req, res) => {
    try {
      // Récupérer l'e-mail du développeur depuis le corps de la requête
      const { email } = req.body;
  
      // Vérifier si le développeur existe dans la base de données
      const SCM = await ScrumMaster.findOne({ email });
      if (!SCM) {
        return res.status(404).json({ message: 'Développeur non trouvé' });
      }
 
      // Récupérer les expériences du développeur
      const experiences = SCM.experiences;
  
      // Répondre avec les expériences récupérées
      res.status(200).json({ experiences });
    } catch (error) {
      // Gérer les erreurs
      res.status(500).json({ message: error.message });
    }
  });

  router.put('/updatePersonalInfo/:email', async (req, res) => {
    try {
      const { email } = req.params;
      const { nationality, emergencyNumber, gmail, etat } = req.body;
  
      // Recherche du développeur par e-mail
      const developer = await ScrumMaster.findOneAndUpdate(
        { 'email': email },
        {
          $set: {
            'profileInfo.nationality': nationality,
            'profileInfo.emergencyNumber': emergencyNumber,
            'profileInfo.gmail': gmail,
            'profileInfo.etat': etat
          }
        },
        { new: true }
      );
  
      if (!developer) {
        return res.status(404).json({ message: "ScrumMaster  introuvable." });
      }
  
      res.status(200).json({ message: "Informations personnelles mises à jour avec succès.", developer });
    } catch (error) {
      console.error("Erreur lors de la mise à jour des informations personnelles:", error);
      res.status(500).json({ message: "Erreur lors de la mise à jour des informations personnelles." });
    }
  });


  /*bloc  Projectttttttttt */ 
  
  router.get('/projects/names-ids/:Assignedteam', async (req, res) => {
    try {
      const assignedTeam = req.params.Assignedteam; // Récupérer l'équipe assignée depuis les paramètres de la requête
  
      // Récupérer uniquement le nom et l'ID de tous les projets ayant l'équipe assignée
      const projects = await Project.find({ projectAssignedTeams: assignedTeam }, { projectName: 1, _id: 1 });
  
      res.json(projects); // Renvoie les projets au format JSON
    } catch (error) {
      console.error('Erreur lors de la récupération des noms et des IDs des projets :', error);
      res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des noms et des IDs des projets' });
    }
  });
const upload = multer({
  storage: storage,
  // Permettre tous les types de fichiers
  fileFilter: function (req, file, cb) {
      cb(null, true);
  },
  // Définir une limite de taille personnalisée
  limits: { fileSize: Infinity } // Limite de taille à Infinity (pas de limite)
});


router.get('/projects/names-ids/:Assignedteam', async (req, res) => {
  try {
    const assignedTeam = req.params.Assignedteam; // Récupérer l'équipe assignée depuis les paramètres de la requête

    // Récupérer uniquement le nom et l'ID de tous les projets ayant l'équipe assignée
    const projects = await Project.find({ projectAssignedTeams: assignedTeam }, { projectName: 1, _id: 1 });

    res.json(projects); // Renvoie les projets au format JSON
  } catch (error) {
    console.error('Erreur lors de la récupération des noms et des IDs des projets :', error);
    res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des noms et des IDs des projets' });
  }
});

router.get('/get-Project/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).json({ message: "L'ID du projet est requis dans les paramètres de la requête" });
    }

    const project = await Project.findById(projectId).populate('projectAssignedTeams');

    if (!project) {
      return res.status(404).json({ message: 'Aucun projet trouvé pour cet ID' });
    }

    let teams = [];

    // Récupérer les détails de l'équipe associée au projet, s'il y en a
    if (project.projectAssignedTeams && !Array.isArray(project.projectAssignedTeams)) {
      const team = await Team.findById(project.projectAssignedTeams);
      if (team) {
        teams.push({
          name: team.name,
          numberOfMembers: team.numberOfMembers
        });
      }
    }

    // Renvoie les détails du projet avec les détails de l'équipe associée au format JSON
    res.status(200).json({
      ...project.toObject(),
      teams: teams
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des détails du projet :', error);
    res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des détails du projet' });
  }
});

router.get('/get-ProjectsAssigne/:assignedTeam', async (req, res) => {
  try {
    const { assignedTeam } = req.params;
    if (!assignedTeam) {
      return res.status(400).json({ message: "L'équipe assignée est requise dans l'URL" });
    }

    // Rechercher les projets assignés à l'équipe spécifiée
    const projects = await Project.find({ projectAssignedTeams: assignedTeam }).populate('projectAssignedTeams');

    if (!projects || projects.length === 0) {
      return res.status(404).json({ message: 'Aucun projet trouvé pour cette équipe assignée' });
    }

    const projectsWithTeamInfo = await Promise.all(projects.map(async project => {
      let teams = [];

      if (project.projectAssignedTeams && !Array.isArray(project.projectAssignedTeams)) {
        const team = await Team.findById(project.projectAssignedTeams);
        if (team) {
          teams.push({
            name: team.name,
            numberOfMembers: team.numberOfMembers
          });
        }
      }

// Calculate progress
      const progress = project.calculateProjectProgress();

      return {
        ...project.toObject(),
        teams: teams,
        progress: progress
      };
    }));

    res.status(200).json(projectsWithTeamInfo);
  } catch (error) {
    console.error('Erreur lors de la récupération des projets :', error);
    res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des projets' });
  }
});

router.get('/get-Project/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).json({ message: "L'ID du projet est requis dans les paramètres de la requête" });
    }

    const project = await Project.findById(projectId).populate('projectAssignedTeams');

    if (!project) {
      return res.status(404).json({ message: 'Aucun projet trouvé pour cet ID' });
    }

    let teams = [];

    // Récupérer les détails de l'équipe associée au projet, s'il y en a
    if (project.projectAssignedTeams && !Array.isArray(project.projectAssignedTeams)) {
      const team = await Team.findById(project.projectAssignedTeams);
      if (team) {
        teams.push({
          name: team.name,
          numberOfMembers: team.numberOfMembers
        });
      }
    }

    // Renvoie les détails du projet avec les détails de l'équipe associée au format JSON
    res.status(200).json({
      ...project.toObject(),
      teams: teams
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des détails du projet :', error);
    res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des détails du projet' });
  }
});

// Créer un nouveau sprint pour un projet donné
router.post('/Create-Sprint/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await Project.findById(projectId);

    // Calculer automatiquement le numéro de sprint
    const sprintNumber = project.sprints.length + 1;

    // Créer un nouveau sprint avec le nom fourni dans le corps de la requête
    const newSprint = {
      sprintName: req.body.sprintName,
      sprintNumber: sprintNumber // Utiliser le numéro de sprint calculé automatiquement
    };

    project.sprints.push(newSprint);
    await project.save();
    res.json(newSprint);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// Lire tous les sprints d'un projet donné
router.get('/get-Sprints/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await Project.findById(projectId);
    const sprints = project.sprints;
    res.json(sprints);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// Mettre à jour les détails d'un sprint
router.put('/update-Sprints/:projectId/:sprintId', async (req, res) => {
  try {
    const { projectId, sprintId } = req.params;
    const { sprintNumber, sprintName } = req.body;
    const project = await Project.findById(projectId);
    const sprint = project.sprints.id(sprintId);
    sprint.sprintNumber = sprintNumber;
    sprint.sprintName = sprintName;
    await project.save();
    res.json(sprint);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// Supprimer un sprint
router.delete('/delete-sprints/:projectId/:sprintId', async (req, res) => {
  try {
    const { projectId, sprintId } = req.params;
    const project = await Project.findById(projectId);
    
    // Utilisez la méthode pull() pour retirer l'élément du tableau
    project.sprints.pull({ _id: sprintId });
    
    await project.save();
    res.json({ message: 'Sprint deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Créer un nouveau ticket pour un sprint donné
router.post('/Create-tickets/:projectId/:sprintId', async (req, res) => {
  try {
    const { projectId, sprintId } = req.params;
    const { emailDeveloppeur } = req.body;
    const developer = await ScrumMaster.findOne({ email: emailDeveloppeur });
    if (!developer) throw new Error('Developer not found');

    const project = await Project.findById(projectId);
    const sprint = project.sprints.id(sprintId);

    // Initialiser les détails du bug avec bug = false par défaut
    const bugDetails = {
      bug: false,
      bugType: "",
      description: "",
      screenshot: ""
    };

    // Ajouter un nouveau ticket avec les détails du bug initialisés
    sprint.tickets.push({ 
      ...req.body, 
      bugDetails: bugDetails, 
      noSprint: sprint.sprintNumber 
    });

    await project.save();
    res.json({ message: 'Ticket created successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Récupérer tous les tickets d'un sprint donné
router.get('/get-s-tickets/:projectId/:sprintId', async (req, res) => {
  try {
    const { projectId, sprintId } = req.params;
    const project = await Project.findById(projectId);
    const sprint = project.sprints.id(sprintId);
    const tickets = sprint.tickets;
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Mettre à jour les détails d'un ticket
router.put('/update-ticket-Info/:projectId/:sprintId/:ticketId', async (req, res) => {
  try {
    const { projectId, sprintId, ticketId } = req.params;

    const project = await Project.findById(projectId);
    const sprint = project.sprints.id(sprintId);
    const ticket = sprint.tickets.id(ticketId);

    // Mettre à jour uniquement les champs du ticket reçus dans le corps de la requête
    ticket.set(req.body);

    await project.save();
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Supprimer un ticket
router.delete('/delete-tickets/:projectId/:sprintId/:ticketId', async (req, res) => {
  try {
    const { projectId, sprintId, ticketId } = req.params;
    const result = await Project.findByIdAndUpdate(
      projectId,
      { $pull: { "sprints.$[sprint].tickets": { _id: ticketId } } },
      { arrayFilters: [{ "sprint._id": sprintId }], new: true }
    );

    if (result) {
      res.json({ message: 'Ticket deleted successfully' });
    } else {
      res.status(404).json({ message: 'Ticket not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Déplacer un ticket vers un nouvel état
router.put('/move-ticket/:projectId/:sprintId/:ticketId', async (req, res) => {
  try {
    const { projectId, sprintId, ticketId } = req.params;
    const { nouvelEtat } = req.body; // nouvelEtat peut être "toDo", "inProgress" ou "completed"

    const project = await Project.findById(projectId);
    const sprint = project.sprints.id(sprintId);
    const ticket = sprint.tickets.id(ticketId);

    // Modifier l'état du ticket
    ticket.ticketState = nouvelEtat;

    await project.save();
    res.json({ message: 'Ticket moved successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/create-bug/:projectId/:sprintId/:ticketId', upload.single('screenshot'), async (req, res) => {
  try {
    const { projectId, sprintId, ticketId } = req.params;
    const { bugType, description } = req.body;

    const project = await Project.findById(projectId);
    const sprint = project.sprints.id(sprintId);
    const ticket = sprint.tickets.id(ticketId);

    // Créer un nouveau bug pour le ticket
    ticket.bug = true;
    let bugDetails = {};

    if (bugType === "technical") {
      bugDetails = {
        type: bugType,
        description: description,
        screenshot: req.file ? req.file.filename : null
      };
    } else if (bugType === "non-technical") {
      bugDetails = {
        type: bugType,
        description: description,
        screenshot: null
      };
    }

    ticket.bugDetails = bugDetails;

    await project.save();
    res.json({ message: 'Bug created successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Mettre à jour les détails d'un bug pour un ticket donné
router.put('/update-bug/:projectId/:sprintId/:ticketId', upload.single('screenshot'), async (req, res) => {
  try {
    const { projectId, sprintId, ticketId } = req.params;
    const { bugType, description } = req.body;

    const project = await Project.findById(projectId);
    const sprint = project.sprints.id(sprintId);
    const ticket = sprint.tickets.id(ticketId);

    // Mettre à jour les détails du bug
    ticket.bugDetails = {
      type: bugType,
      description: description,
      screenshot: req.file ? req.file.filename : null
    };

    await project.save();
    res.json({ message: 'Bug updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Récupérer les détails d'un bug pour un ticket donné
router.get('/get-bug/:projectId/:sprintId/:ticketId', async (req, res) => {
  try {
    const { projectId, sprintId, ticketId } = req.params;
    const project = await Project.findById(projectId);
    const sprint = project.sprints.id(sprintId);
    const ticket = sprint.tickets.id(ticketId);

    if (!ticket.bug) {
      return res.status(404).json({ message: 'No bug found for this ticket' });
    }

    res.json(ticket.bugDetails);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Route pour récupérer la capture d'écran du ticket
router.get('/get-ticket-screenshot/:projectId/:sprintId/:ticketId', async (req, res) => {
  try {
    const { projectId, sprintId, ticketId } = req.params;
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ message: "Projet non trouvé" });
    }

    const sprint = project.sprints.find(sprint => sprint._id.toString() === sprintId);

    if (!sprint) {
      return res.status(404).json({ message: "Sprint non trouvé" });
    }

    const ticket = sprint.tickets.find(ticket => ticket._id.toString() === ticketId);

    if (!ticket || !ticket.bugDetails || !ticket.bugDetails.screenshot) {
      return res.status(404).json({ message: "Capture d'écran du ticket non trouvée" });
    }

    // Construire le chemin absolu vers le fichier image
    const imagePath = path.join(__dirname, '..', 'assets', ticket.bugDetails.screenshot);

    // Vérifier si le fichier existe
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ message: "Capture d'écran du ticket non trouvée" });
    }

    // Lire le contenu du fichier image
    const imageContent = fs.readFileSync(imagePath);

    // Définir le type de contenu sur 'image/jpeg' ou 'image/png' selon le format de l'image
    res.set('Content-Type', 'image/jpeg');

    // Envoyer le contenu de l'image en réponse
    res.send(imageContent);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Supprimer un bug pour un ticket donné
router.delete('/delete-bug/:projectId/:sprintId/:ticketId', async (req, res) => {
  try {
    const { projectId, sprintId, ticketId } = req.params;

    const project = await Project.findById(projectId);
    const sprint = project.sprints.id(sprintId);
    const ticket = sprint.tickets.id(ticketId);

    if (!ticket.bug) {
      return res.status(404).json({ message: 'No bug found for this ticket' });
    }

    // Réinitialiser les détails du bug
    ticket.bug = false;
    ticket.bugDetails = {
      type: null,
      description: null,
      screenshot: null
    };

    await project.save();
    res.json({ message: 'Bug deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});



router.post('/create-output/:projectId/:sprintId/:ticketId', upload.array('output', 5), async (req, res) => {
  try {
    const { projectId, sprintId, ticketId } = req.params;
    const { description, nameOutput } = req.body;

    const project = await Project.findById(projectId);
    const sprint = project.sprints.id(sprintId);
    const ticket = sprint.tickets.id(ticketId);

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Vérifier s'il y a de nouvelles captures d'écran téléchargées
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No output uploaded" });
    }

    // Créer un nouvel output pour chaque fichier téléchargé
    req.files.forEach((file, index) => {
      const newOutput = {
        nameOutput: nameOutput,
        description: description, // Description de l'output
        outputCapture: file.filename // URL ou nom du fichier
      };
      ticket.outputs.push(newOutput);
    });

    await project.save();

    // Répondre avec un message de succès
    res.status(201).json({ message: 'Outputs created successfully', outputs: ticket.outputs });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});



// Route pour récupérer une capture d'écran spécifique d'un ticket
router.get('/get-output/:projectId/:sprintId/:ticketId/:outputId', async (req, res) => {
  try {
    const { projectId, sprintId, ticketId, outputId } = req.params;
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ message: "Projet non trouvé" });
    }

    const sprint = project.sprints.find(sprint => sprint._id.toString() === sprintId);

    if (!sprint) {
      return res.status(404).json({ message: "Sprint non trouvé" });
    }

    const ticket = sprint.tickets.find(ticket => ticket._id.toString() === ticketId);

    if (!ticket || !ticket.outputs || ticket.outputs.length === 0) {
      return res.status(404).json({ message: "Aucune capture d'écran trouvée pour ce ticket" });
    }

    const output = ticket.outputs.find(output => output._id.toString() === outputId);

    if (!output) {
      return res.status(404).json({ message: "Capture d'écran non trouvée pour cet ID" });
    }

    // Construire le chemin absolu vers le fichier image
    const imagePath = path.join(__dirname, '..', 'assets', output.outputCapture);

    // Vérifier si le fichier existe
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ message: "Capture d'écran non trouvée pour cet ID" });
    }

    // Lire le contenu du fichier image
    const imageContent = fs.readFileSync(imagePath);

    // Définir le type de contenu sur 'image/jpeg' ou 'image/png' selon le format de l'image
    res.set('Content-Type', 'image/jpeg');

    // Envoyer le contenu de l'image en réponse
    res.send(imageContent);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Route pour récupérer les entités de sortie d'un ticket
router.get('/outputs/:projectId/:sprintId/:ticketId', async (req, res) => {
  try {
    const { projectId, sprintId, ticketId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Projet non trouvé' });
    }

    const sprint = project.sprints.id(sprintId);
    if (!sprint) {
      return res.status(404).json({ message: 'Sprint non trouvé' });
    }

    const ticket = sprint.tickets.id(ticketId);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket non trouvé' });
    }

    res.status(200).json({ outputs: ticket.outputs });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});



// Route pour supprimer une capture d'écran spécifique d'un ticket
router.delete('/delete-output/:projectId/:sprintId/:ticketId/:outputId', async (req, res) => {
  try {
    const { projectId, sprintId, ticketId, outputId } = req.params;
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ message: "Projet non trouvé" });
    }

    const sprint = project.sprints.find(sprint => sprint._id.toString() === sprintId);

    if (!sprint) {
      return res.status(404).json({ message: "Sprint non trouvé" });
    }

    const ticket = sprint.tickets.find(ticket => ticket._id.toString() === ticketId);

    if (!ticket || !ticket.outputs || ticket.outputs.length === 0) {
      return res.status(404).json({ message: "Aucune capture d'écran trouvée pour ce ticket" });
    }

    const outputIndex = ticket.outputs.findIndex(output => output._id.toString() === outputId);

    if (outputIndex === -1) {
      return res.status(404).json({ message: "Capture d'écran non trouvée pour cet ID" });
    }

    // Supprimer la capture d'écran du tableau des outputs
    ticket.outputs.splice(outputIndex, 1);

    // Enregistrer les modifications
    await project.save();

    res.json({ message: "Capture d'écran supprimée avec succès" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// Supprimer toutes les sorties d'un ticket
router.delete("/delete-all-outputs/:projectId/:sprintId/:ticketId", async (req, res) => {
  try {
    const { projectId, sprintId, ticketId } = req.params;
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ message: "Projet non trouvé" });
    }

    const sprint = project.sprints.find(sprint => sprint._id.toString() === sprintId);

    if (!sprint) {
      return res.status(404).json({ message: "Sprint non trouvé" });
    }

    const ticket = sprint.tickets.find(ticket => ticket._id.toString() === ticketId);

    if (!ticket || !ticket.outputs || ticket.outputs.length === 0) {
      return res.status(404).json({ message: "Aucune sortie trouvée pour ce ticket" });
    }

    // Supprimer toutes les sorties du ticket
    ticket.outputs = [];

    // Enregistrer les modifications
    await project.save();

    res.status(200).json({ message: "Toutes les sorties du ticket ont été supprimées avec succès" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});



//Route Pour Connection User 


/// Route pour récupérer l'état de connexion d'un développeur
router.get('/isConnected/:UserId', async (req, res) => {
  try {
    const UserId = req.params.UserId;
    const isConnected = await getIsConnected(UserId);
    res.json({ isConnected });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur du serveur' });
  }
});

// Méthode pour récupérer l'état de connexion d'un développeur
async function getIsConnected(developerId) {
  try {
    // Trouver le développeur par ID
    const developer = await ScrumMaster.findById(developerId);

    if (developer && developer.attendanceData.length > 0) {
      // Récupérer la dernière entrée d'assiduité
      const latestAttendance = developer.attendanceData[developer.attendanceData.length - 1];
      return latestAttendance.isConnected;
    } else {
      return false; // Retourne false si aucun développeur n'est trouvé ou s'il n'y a aucune donnée d'assiduité
    }
  } catch (error) {
    console.error(error);
    throw error;
  }
}



router.post('/add-dailyscrum/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { dailyProgram, name, email, teamId } = req.body;

    // Vérifiez si les données requises sont fournies
    if (!dailyProgram) {
      return res.status(400).send('dailyProgram is required');
    }

    // Convertir dailyProgram en date sans l'heure
    const dailyProgramDate = new Date(dailyProgram);
    dailyProgramDate.setHours(0, 0, 0, 0);

    // Vérifiez si le projet existe
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).send('Project not found');
    }

    // Vérifier s'il existe déjà un Daily Scrum pour cette date
    const existingDailyScrum = project.dailyScrums.find(dailyScrum => {
      const existingDate = new Date(dailyScrum.dailyProgram);
      existingDate.setHours(0, 0, 0, 0);
      return existingDate.getTime() === dailyProgramDate.getTime();
    });

    if (existingDailyScrum) {
      return res.status(400).send('A Daily Scrum already exists for this date');
    }

    // Ajoutez le dailyScrum au projet
    const newDailyScrum = { 
      dailyProgram, 
      dailyUrl: "", 
      added: false, 
      annuler: false // Ajout de l'attribut Annuler
    };

    await teamNotificationController.saveTeamNotification(teamId, email, name, `Ajouter une DailyScrum à ${dailyProgramDate.toLocaleString('en-CA', {year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'})}`, "scrumMasters");
    project.dailyScrums.push(newDailyScrum);
    await project.save();

    // Réponse avec le projet mis à jour
    res.status(201).json(newDailyScrum);
  } catch (error) {
    // En cas d'erreur, renvoyez un message d'erreur
    res.status(400).send(error.message);
  }
});

router.get('/check-daily-status/:projectId/:scrumId', async (req, res) => {
  const { projectId, scrumId } = req.params;
  const { teamId, name, email } = req.query; // Récupérer les données de l'équipe, le nom et l'e-mail

  try {
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).send('Project not found');
    }
    
    const dailyScrum = project.dailyScrums.id(scrumId);
    if (!dailyScrum) {
      return res.status(404).send('Daily Scrum not found');
    }
    
    const currentTime = new Date();
    const dailyTime = new Date(dailyScrum.dailyProgram);
    const timeDifference = (dailyTime - currentTime) / 1000; // Différence en secondes

    // Si le temps est écoulé et que l'URL n'est pas encore ajoutée, annuler le daily
    if (timeDifference < -160 && !dailyScrum.added && !dailyScrum.annuler) {
      dailyScrum.annuler = true;

      // Sauvegarder l'ensemble du projet pour garantir que les sous-documents sont mis à jour
      await project.save();
      
      // Ajouter la notification pour l'annulation
      await teamNotificationController.saveTeamNotification(teamId, email, name, `La réunion quotidienne a été annulée`, "scrumMasters");
    }

    return res.status(200).json({
      openModal: timeDifference >= -300 && timeDifference <= 0 && !dailyScrum.added,
      timeLeft: timeDifference,
      status: dailyScrum.annuler ? 'Reported' : (dailyScrum.added ? 'Complete' : 'Pending'),
      annuler: dailyScrum.annuler
    });
  } catch (error) {
    console.error('Error checking Daily Scrum status:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});



// Route pour mettre à jour l'URL, l'état ajouté et l'attribut Annuler du Daily Scrum
router.put('/update-UrlAndAdded/:projectId/:scrumId', async (req, res) => {
  try {
    const { projectId, scrumId } = req.params;
    const { dailyUrl, added } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).send('Project not found');
    }

    const dailyScrum = project.dailyScrums.id(scrumId);
    if (!dailyScrum) {
      return res.status(404).send('Daily Scrum not found');
    }

    dailyScrum.dailyUrl = dailyUrl;
    dailyScrum.added = !!dailyUrl; // Mettre à jour ajouté en fonction de la valeur de dailyUrl
    dailyScrum.annuler = false; // Réinitialiser Annuler à false lors de la mise à jour de l'URL

    await project.save();

    res.status(200).send(project);
  } catch (error) {
    res.status(400).send(error.message);
  }
});







router.put('/updatedailyscrum/:projectId/:dailyScrumId', async (req, res) => {
  try {
    const { projectId, dailyScrumId } = req.params;
    const { dailyProgram , name,email,teamId} = req.body;

    // Recherche du projet par ID
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Recherche et mise à jour du DailyScrum dans le projet
    const dailyScrum = project.dailyScrums.id(dailyScrumId);
    if (!dailyScrum) {
      return res.status(404).json({ message: 'DailyScrum not found' });
    }

    // Mise à jour du champ dailyProgram
    dailyScrum.dailyProgram = dailyProgram;
    await teamNotificationController.saveTeamNotification(teamId, email,name,`A Modifier l'heure  DailyScrum à ${dailyProgram.toLocaleString('en-CA', {year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'})}`, "scrumMasters");
    await project.save();

    res.status(200).json(dailyScrum);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});



router.delete('/delete-dailyscrum/:projectId/:dailyScrumId', async (req, res) => {
  try {
    const { projectId, dailyScrumId } = req.params;
    const { name,email,teamId} = req.body;
    // Recherche du projet par ID
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Recherche et suppression du DailyScrum dans le projet
    const updatedDailyScrums = project.dailyScrums.filter((ds) => ds._id.toString() !== dailyScrumId);
    if (project.dailyScrums.length === updatedDailyScrums.length) {
      return res.status(404).json({ message: 'DailyScrum not found' });
    }

    project.dailyScrums = updatedDailyScrums;
    await teamNotificationController.saveTeamNotification(teamId, email,name, "a delete DailyScrum ", "scrumMasters");
    await project.save();

    res.status(200).json({ message: 'DailyScrum deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// Récupérer les "daily" d'un projet spécifique
router.get('/get-daily/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    // Recherche du projet par ID
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).send('Project not found');
    }

    // Récupérer les "daily" du projet avec le nom du projet
    const dailyScrums = project.dailyScrums.map(daily => {
      return {
        ...daily.toObject(),
        projectName: project.projectName
      };
    });

    res.status(200).json(dailyScrums);
  } catch (error) {
    res.status(400).send(error.message);
  }
});



module.exports = router;
