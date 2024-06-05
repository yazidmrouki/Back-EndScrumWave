// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const Developer = require("../models/User");
const Team = require("../models/Teams");
const ScrumMaster = require("../models/SM");
const ProductOwner = require("../models/Po");
// GET all developers
const { generateJWTToken } = require('../utils/authUtils');
const { isValidPassword}=require('../utils/Verifier');
const bcrypt = require('bcrypt');
const { LocalStorage } = require('node-localstorage');
const localStorage = new LocalStorage('./scratch');
const multer = require('multer');
const moment = require('moment');

const fs = require('fs');
const path = require('path');
const Project=require("../models/Projet");
const { handleSignIn, handleSignOut }= require('../utils/attendanceController');


const teamNotificationController = require('../utils/notificatioCont');
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

      // Stocker l'ID du développeur dans le localStorage

       
      // Créer un nouvel utilisateur avec le mot de passe haché
      const newUser = await Developer.create({ nom, prenom, email, password: hashedPassword, type,AssignedTeams:null });
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
  


// Route pour la connexion d'un ScrumMaster
router.post('/signin', async (req, res) => {
    try {
        const { email, password } = req.body;
        
    
        const user = await Developer.findOne({ email });
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
        
        await handleSignIn(user._id,"Développeur");
       
        const Assignedteam=user.assignedTeams;
        const name=user.nom+" "+user.prenom;
        const id=user._id;
         console.log(Assignedteam);

         await teamNotificationController.saveTeamNotification(Assignedteam, email, name, "a Connecté","Devellopeurs");
        res.status(200).json({ token,id,Assignedteam,name,email});
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
router.post('/signout', async (req, res) => {
  try {
    const { developerId } = req.body;
    
    // Récupérer les informations du développeur
    const developer = await Developer.findById(developerId);
    if (!developer) {
      return res.status(404).json({ message: 'Développeur non trouvé' });
    }

    // Appeler la fonction handleSignOut
    await handleSignOut(developerId, "Développeur");

    // Préparer les informations pour la notification
    const assignedTeams = developer.assignedTeams;
    const email = developer.email;
    const name = `${developer.nom} ${developer.prenom}`;

    // Enregistrer les notifications pour chaque équipe assignée
    await teamNotificationController.saveTeamNotification(assignedTeams, email, name, " a Déconnecté", "Devellopeurs");

    res.status(200).json({ message: 'Déconnexion réussie' });
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

    router.put('/updatePersonalInfo/:email', async (req, res) => {
      try {
        const { email } = req.params;
        const { nationality, emergencyNumber, gmail, etat } = req.body;
    
        // Recherche du développeur par e-mail
        const developer = await Developer.findOneAndUpdate(
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
          return res.status(404).json({ message: "Développeur introuvable." });
        }
    
        res.status(200).json({ message: "Informations personnelles mises à jour avec succès.", developer });
      } catch (error) {
        console.error("Erreur lors de la mise à jour des informations personnelles:", error);
        res.status(500).json({ message: "Erreur lors de la mise à jour des informations personnelles." });
      }
    });
    
    router.put('/UpdateInfo/:email', async (req, res) => {
      try {
        const { email } = req.params;
          const { nom, prenom, adresse, description, phone, birthday } = req.body;
    
          // Rechercher l'utilisateur par e-mail
          const newUser= await Developer.findOne({ email });
    
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



  
// Configuration du stockage Multer pour les photos de profil
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './assets');
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + "_" + Date.now() + path.extname(file.originalname));
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

// Configuration de l'upload avec Multer
const uploadd = multer({ storage: storage });




// Route pour mettre à jour la photo de profil de l'utilisateur
router.post('/update-profile-photo', uploadd.single('photo'), async (req, res) => {
  try {
    const { email } = req.body;

    // Rechercher l'utilisateur par e-mail
    const developer = await Developer.findOne({ email });

    if (!developer) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    // Vérifier si une nouvelle photo a été téléchargée
    if (!req.file) {
      return res.status(400).json({ message: "Aucune photo téléchargée" });
    }

    // Mettre à jour les informations de la photo de profil
     // Mettre à jour le chemin de la photo de profil dans le document de l'utilisateur
     developer.profileInfo.photo = req.file.filename;

     await teamNotificationController.saveTeamNotification(developer.assignedTeams, developer.email, developer.nom, "à Changer le photo de profile ", "Devellopeurs");
    // Sauvegarder les modifications dans la base de données
    await developer.save();

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
    const developer = await Developer.findOne({ email });

    if (!developer || !developer.profileInfo.photo) {
      return res.status(404).json({ message: "Photo de profil non trouvée" });
    }

    // Construire le chemin absolu vers le fichier image
    const imagePath = path.join(__dirname, '..', 'assets', developer.profileInfo.photo);

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















// routes/userRoutes.js/gettttttttttttttttttttttttttttttttttttttttttttttttttttttttttttt


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
        projectName: project.name
      };
    });

    res.status(200).json(dailyScrums);
  } catch (error) {
    res.status(400).send(error.message);
  }
});



router.post('/get-experiences', async (req, res) => {
  try {
    // Récupérer l'e-mail du développeur depuis le corps de la requête
    const { email } = req.body;

    // Vérifier si le développeur existe dans la base de données
    const developer = await Developer.findOne({ email });
    if (!developer) {
      return res.status(404).json({ message: 'Développeur non trouvé' });
    }

    // Récupérer les expériences du développeur
    const experiences = developer.experiences;

    // Répondre avec les expériences récupérées
    res.status(200).json({ experiences });
  } catch (error) {
    // Gérer les erreurs
    res.status(500).json({ message: error.message });
  }
});

router.get('/my-team/:developerId', async (req, res) => {
  try {
    const developerId = req.params.developerId;

    // Trouver l'équipe à laquelle le développeur est associé
    const team = await Team.findOne({ developer: developerId });
    if (!team) {
      return res.status(200).json({ developers: [], scrumMasters: [], productOwners: [], team: null });
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







/*bloc  Projectttttttttt */ 


router.get('/projects/dates/:projectId', async (req, res) => {
  try {
    const projectId = req.params.projectId;

    // Rechercher le projet par son ID
    const project = await Project.findById(projectId);

    if (!project) {
      return res.json(null);
    }

    let projectStartDate = project.projectStartDate ? project.projectStartDate.toISOString().split('T')[0] : null;
    let projectEndDate = project.projectEndDate ? project.projectEndDate.toISOString().split('T')[0] : null;
    let sprintStartDate = null;
    let sprintEndDate = null;

    // Vérifier s'il y a des sprints associés au projet
    if (project.sprints.length > 0) {
      // Trier les sprints par date de fin pour obtenir le dernier sprint
      const lastSprint = project.sprints.sort((a, b) => new Date(b.sprintEndDate) - new Date(a.sprintEndDate))[0];
      
      sprintStartDate = lastSprint.sprintStartDate ? lastSprint.sprintStartDate.toISOString().split('T')[0] : null;
      sprintEndDate = lastSprint.sprintEndDate ? lastSprint.sprintEndDate.toISOString().split('T')[0] : null;

      // Si la date de fin du sprint est disponible et que la date de fin du projet est nulle,
      // mettez à jour la date de début du projet avec la date de fin du sprint
      if (sprintEndDate !== null ) {
        projectStartDate = sprintEndDate;
      }
    }

    // Retourner les dates de début et de fin du projet ainsi que la date de début et de fin du dernier sprint
    res.json({
      projectId: projectId,
      projectStartDate: projectStartDate,
      projectEndDate: projectEndDate,
      sprintStartDate: sprintStartDate,
      sprintEndDate: sprintEndDate
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des dates du projet et du dernier sprint :', error);
    res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des dates du projet et du dernier sprint' });
  }
});



// Middleware pour récupérer les dates de début et de fin du projet ainsi que du dernier sprint
router.get('/projects/date-Update/:projectId/:sprintId', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const sprintId = req.params.sprintId;

    // Recherche du projet par son ID
    const project = await Project.findById(projectId);

    if (!project) {
      return res.json(null);
    }

    // Recherche du sprint correspondant à l'ID fourni
    const sprintIndex = project.sprints.findIndex(s => s._id.toString() === sprintId.toString());

    if (sprintIndex === -1) {
      return res.json(null);
    }

    // Déterminer les dates de début et de fin en fonction de l'index du sprint
    let startDate, endDate;

    if (sprintIndex > 0) {
      // S'il y a un sprint précédent, utiliser sa date de fin comme date de début
      startDate = project.sprints[sprintIndex - 1].sprintEndDate.toISOString().split('T')[0];
    } else {
      // Sinon, utiliser la date de début du projet
      startDate = project.projectStartDate.toISOString().split('T')[0];
    }

    if (sprintIndex < project.sprints.length - 1) {
      // S'il y a un sprint suivant, utiliser sa date de début comme date de fin
      endDate = project.sprints[sprintIndex + 1].sprintStartDate.toISOString().split('T')[0];
    } else {
      // Sinon, utiliser la date de fin du projet
      endDate = project.projectEndDate.toISOString().split('T')[0];
    }

    res.json({
      projectId: projectId,
      sprintId: sprintId,
      startDate: startDate,
      endDate: endDate
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des dates du sprint :', error);
    res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des dates du sprint' });
  }
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

router.get('/get-daily/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    // Recherche du projet par ID
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).send('Project not found');
    }

    // Récupérer les "daily" du projet
    const dailyScrums = project.dailyScrums;

    res.status(200).json(dailyScrums);
  } catch (error) {
    res.status(400).send(error.message);
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
      return res.json(null); // Renvoyer null si aucun projet n'est trouvé
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
// Route pour vérifier si un daily meeting est programmé pour aujourd'hui
router.get('/check-daily-today/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).send('Project not found');
    }

    const today = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
    const dailyToday = project.dailyScrums.find(daily => daily.date === today);

    if (!dailyToday) {
      return res.status(200).json(null);
    }

    res.status(200).json(dailyToday);
  } catch (error) {
    res.status(400).send(error.message);
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
router.get('/check-daily/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).json({ message: "L'ID du projet est requis dans les paramètres de la requête" });
    }

    // Récupérer les détails du projet
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ message: 'Aucun projet trouvé pour cet ID' });
    }

    // Vérifier s'il y a des réunions quotidiennes pour ce projet
    const dailyScrums = project.dailyScrums;

    // Si aucune réunion quotidienne n'est définie dans le projet
    if (!dailyScrums || dailyScrums.length === 0) {
     
      return res.json({ found: false, meetingUrl: null });
    }

    // Parcourir les réunions quotidiennes pour vérifier si l'une d'elles est passée entre 0 et 5 minutes
    const now = moment();
    for (const scrum of dailyScrums) {
      const meetingTime = moment(scrum.dailyProgram);
      const diffInMillis = now.diff(meetingTime, 'milliseconds');
    
      // Si la réunion est passée entre 0 et 5 minutes, retourner true avec l'heure de la réunion
      if (diffInMillis >= 0 && diffInMillis <= (5 * 60 * 1000)) { // Convertir 5 minutes en millisecondes
        return res.json({ found: true, meetingUrl: scrum.dailyUrl });
      }
    }
    

    // Si aucune réunion quotidienne n'est passée entre 0 et 5 minutes, retourner false
    return res.json({ found: false, meetingUrl: null });
  } catch (error) {
    console.error('Error checking daily meeting:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
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

router.get('/get-s-tickets/:projectId/:sprintId', async (req, res) => {
  try {
    const { projectId, sprintId } = req.params;
    const project = await Project.findById(projectId);
    
    if (!project) {
      // Si le projet n'est pas trouvé, renvoyer une réponse vide
      return res.json([]);
    }
    
    const sprint = project.sprints.id(sprintId);
    
   
    if (!project) {
      // Si le projet n'est pas trouvé, renvoyer une réponse vide
      return res.json([]);
    }
    
    const tickets = sprint.tickets;
    
    // Vérifier si des tickets ont été trouvés
    if (!tickets || tickets.length === 0) {
      // Si aucun ticket n'est trouvé, renvoyer une réponse vide
      return res.json([]);
    }
    
    // Si des tickets sont trouvés, les renvoyer
    res.json(tickets);
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



// Récupérer les activités récentes d'un projet spécifique
router.get('/recent-activities/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ message: 'Projet non trouvé' });
    }

    res.json({ recentActivities: project.recentActivities });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});



//Router Pour les Connection 

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
    const developer = await Developer.findById(developerId);

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
// routes/userRoutes.js/gettttttttttttttttttttttttttttttttttttttttttttttttttttttttttttt






// routes/userRoutes.js/createeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
router.post('/create-sprint/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { nameActor, email, sprintName, sprintStartDate, sprintEndDate } = req.body;
    const project = await Project.findById(projectId);

   

    const projectStartDate = new Date(project.projectStartDate);
    const projectEndDate = new Date(project.projectEndDate);

    const proposedSprintStartDate = new Date(sprintStartDate);
    const proposedSprintEndDate = new Date(sprintEndDate);

    // Trouver la date de fin du dernier sprint créé dans le projet
    const lastSprint = project.sprints[project.sprints.length - 1];
    const lastSprintEndDate = lastSprint ? new Date(lastSprint.sprintEndDate) : null;

    if (
      proposedSprintStartDate <= projectStartDate ||
      proposedSprintEndDate > projectEndDate ||
      proposedSprintStartDate >= proposedSprintEndDate
    ) {
      return res.status(400).json({ message: "Les dates de début et de fin du sprint doivent être comprises entre les dates de début et de fin du projet, et la date de début doit être antérieure à la date de fin." });
    }
    

    

    // Calculer automatiquement le numéro de sprint
    const sprintNumber = project.sprints.length + 1;

    // Créer un nouveau sprint avec les détails fournis dans le corps de la requête
    const newSprint = {
      sprintName,
      sprintNumber,
      sprintStartDate: proposedSprintStartDate,
      sprintEndDate: proposedSprintEndDate
    };

    project.sprints.push(newSprint);
    await project.addRecentActivity(nameActor, email, `Le sprint "${sprintName}" a été créé.`);
    await teamNotificationController.saveTeamNotification(project.projectAssignedTeams ,email, nameActor, `Create NewSprint ${sprintName} `, "Devellopeurs");
    await project.save();
    res.status(201).json(newSprint);
  } catch (error) {
    console.error('Erreur lors de la création du sprint :', error);
    res.status(500).json({ message: "Une erreur s'est produite lors de la création du sprint." });
  }
});

// Déplacer un ticket vers un nouvel état
router.put('/move-ticket/:projectId/:sprintId/:ticketId', async (req, res) => {
  try {
    const { projectId, sprintId, ticketId } = req.params;
    const { nouvelEtat, nameActor, email } = req.body; // nouvelEtat peut être "toDo", "inProgress" ou "completed"

    const project = await Project.findById(projectId);
    const sprint = project.sprints.id(sprintId);
    const ticket = sprint.tickets.id(ticketId);

    // Modifier l'état du ticket
    ticket.ticketState = nouvelEtat;

    await project.addRecentActivity(nameActor, email, `Le ticket  #Tk-${ticket.numTicket} "${ticket.ticketInfo}" a été déplacé vers "${nouvelEtat}" dans le sprint "${sprint.sprintName}".`);
    await teamNotificationController.saveTeamNotification(project.projectAssignedTeams ,email, nameActor, `Le ticket  #Tk-${ticket.numTicket} "${ticket.ticketInfo}" a été déplacé vers "${nouvelEtat}" dans le sprint "${sprint.sprintName}".`, "Devellopeurs");
    await project.save();

    res.json({ message: 'Ticket moved successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});



// Ajouter une route pour ajouter une nouvelle expérience
router.post('/add-experience', async (req, res) => {
  try {
    // Récupérer l'e-mail du développeur depuis le corps de la requête
    const { email } = req.body;

    // Récupérer les données de la nouvelle expérience depuis le corps de la requête
    const { title, company, startDate, endDate, description } = req.body;

    // Vérifier si le développeur existe dans la base de données
    const developer = await Developer.findOne({ email });
    if (!developer) {
      return res.status(404).json({ message: 'Développeur non trouvé' });
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
    developer.experiences.push(newExperience);

    // Sauvegarder les modifications dans la base de données
    await developer.save();

    // Répondre avec un message de succès et les données de la nouvelle expérience
    res.status(201).json({ message: 'Nouvelle expérience ajoutée avec succès', newExperience });
  } catch (error) {
    // Gérer les erreurs
    res.status(500).json({ message: error.message });
  }
});

// Créer un nouveau ticket pour un sprint donné
router.post('/create-ticket/:projectId/:sprintId', async (req, res) => {
  try {
    const { projectId, sprintId } = req.params;
    const { nameActor, email, emailDeveloppeur } = req.body;
    const developer = await Developer.findOne({ email: emailDeveloppeur });
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

    await project.addRecentActivity(nameActor, email, `Un nouveau ticket a été créé dans le sprint "${sprint.sprintName}".`);
    await teamNotificationController.saveTeamNotification(project.projectAssignedTeams ,email, nameActor, `Un nouveau ticket a été créé dans le sprint ${sprint.sprintName} `, "Devellopeurs");
    await project.save();
    res.json({ message: 'Ticket created successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// Créer un nouveau bug pour un ticket donné
router.post('/create-bug/:projectId/:sprintId/:ticketId', upload.single('screenshot'), async (req, res) => {
  try {
    const { projectId, sprintId, ticketId} = req.params;
    const { bugType, description, nameActor, email } = req.body;

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
    await project.addRecentActivity(nameActor, email, `Created a bug for the ticket  #Tk-${ticket.numTicket} "${ticket.ticketInfo}"`);
    await teamNotificationController.saveTeamNotification(project.projectAssignedTeams ,email, nameActor,  `Created a bug for the ticket  #Tk-${ticket.numTicket} "${ticket.ticketInfo}"`, "Devellopeurs");
    await project.save();
   
    res.json({ message: 'Bug created successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
router.post('/create-output/:projectId/:sprintId/:ticketId', upload.array('output', 5), async (req, res) => {
  try {
    const { projectId, sprintId, ticketId } = req.params;
    const { description, nameOutput, nameActor, email } = req.body;

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

    await project.addRecentActivity(nameActor, email, `Created an output for the ticket #Tk-${ticket.numTicket} "${ticket.ticketInfo}"`);
    await teamNotificationController.saveTeamNotification(project.projectAssignedTeams ,email, nameActor, `Created an output for the ticket #Tk-${ticket.numTicket} "${ticket.ticketInfo}"`, "Devellopeurs");
    await project.save();

    // Répondre avec un message de succès
    res.status(201).json({ message: 'Outputs created successfully', outputs: ticket.outputs });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// routes/userRoutes.js/createeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee















//route s uptttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttt



router.put('/update-sprint/:projectId/:sprintId', async (req, res) => {
  try {
    const { projectId, sprintId } = req.params;
    const { nameActor, email, sprintStartDate, sprintEndDate, sprintName } = req.body; // Ajout de sprintStartDate et sprintEndDate

    // Recherche du projet par ID
    const project = await Project.findById(projectId);

    // Recherche du sprint à mettre à jour par ID
    const sprint = project.sprints.id(sprintId);

    // Stockage de l'ancien nom du sprint pour les notifications
    const oldSprintName = sprint.sprintName;

    // Mise à jour des propriétés du sprint
    sprint.sprintName = sprintName;
    sprint.sprintStartDate = sprintStartDate; // Mise à jour de la date de début du sprint
    sprint.sprintEndDate = sprintEndDate; // Mise à jour de la date de fin du sprint

    // Enregistrement de l'activité récente et des notifications
    await project.addRecentActivity(nameActor, email, `Le sprint "${oldSprintName}" a été mis à jour en "${sprintName}".`);
    await teamNotificationController.saveTeamNotification(project.projectAssignedTeams, email, nameActor, `Le sprint "${oldSprintName}" a été mis à jour en "${sprintName}".`, "Devellopeurs");

    // Sauvegarde des modifications du projet
    await project.save();
    
    // Réponse avec les détails mis à jour du sprint
    res.json(sprint);
  } catch (error) {
    // Gestion des erreurs
    res.status(500).json({ message: error.message });
  }
});
// Mettre à jour les informations d'un ticket
router.put('/update-ticket-info/:projectId/:sprintId/:ticketId', async (req, res) => {
  try {
    const { projectId, sprintId, ticketId } = req.params;
    const { nameActor, email } = req.body;

    const project = await Project.findById(projectId);
    const sprint = project.sprints.id(sprintId);
    const ticket = sprint.tickets.id(ticketId);

    // Mettre à jour uniquement les champs du ticket reçus dans le corps de la requête
    ticket.set(req.body);

    await project.addRecentActivity(nameActor, email, `Les informations du ticket "${ticket.ticketInfo}" ont été mises à jour.`);
    await teamNotificationController.saveTeamNotification(project.projectAssignedTeams ,email, nameActor,  `Les informations du ticket "${ticket.ticketInfo}" ont été mises à jour.`, "Devellopeurs");
    await project.save();
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Mettre à jour les détails d'un bug pour un ticket donné
router.put('/update-bug/:projectId/:sprintId/:ticketId', upload.single('screenshot'), async (req, res) => {
  try {
    const { projectId, sprintId, ticketId } = req.params;
    const { bugType, description, nameActor, email } = req.body;

    const project = await Project.findById(projectId);
    const sprint = project.sprints.id(sprintId);
    const ticket = sprint.tickets.id(ticketId);

    // Mettre à jour les détails du bug
    ticket.bugDetails = {
      type: bugType,
      description: description,
      screenshot: req.file ? req.file.filename : null
    };
    await project.addRecentActivity(nameActor, email, `Updated the bug for the ticket #Tk-${ticket.numTicket}  "${ticket.ticketInfo}"`);
    await teamNotificationController.saveTeamNotification(project.projectAssignedTeams ,email, nameActor, `Updated the bug for the ticket #Tk-${ticket.numTicket}  "${ticket.ticketInfo}"`, "Devellopeurs");
    await project.save();
   
    res.json({ message: 'Bug updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


//route uptttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttt





//route deleteeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee



// Supprimer un sprint
router.delete('/delete-sprint/:projectId/:sprintId', async (req, res) => {
  try {
    const { projectId, sprintId } = req.params;
    const { nameActor, email } = req.body;
    const project = await Project.findById(projectId);
    const sprint = project.sprints.id(sprintId);
    const sprintName = sprint.sprintName;

    // Utilisez la méthode pull() pour retirer l'élément du tableau
    project.sprints.pull({ _id: sprintId });

    await project.addRecentActivity(nameActor, email, `Le sprint "${sprintName}" a été supprimé.`);
    await teamNotificationController.saveTeamNotification(project.projectAssignedTeams ,email, nameActor, `Le sprint "${sprintName}" a été supprimé.`, "Devellopeurs");
    await project.save();

    res.json({ message: 'Sprint deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});





// Supprimer un ticket
router.delete('/delete-ticket/:projectId/:sprintId/:ticketId', async (req, res) => {
  try {
    const { projectId, sprintId, ticketId } = req.params;
    const { nameActor, email } = req.body;
    const project = await Project.findById(projectId);
    const sprint = project.sprints.id(sprintId);

    // Utilisez la méthode pull() pour retirer le ticket du sprint
    sprint.tickets.pull({ _id: ticketId });

    await project.addRecentActivity(nameActor, email, `Le ticket "${ticketId}" a été supprimé du sprint "${sprint.sprintName}".`);
    await teamNotificationController.saveTeamNotification(project.projectAssignedTeams ,email, nameActor,  `Le ticket "${ticketId}" a été supprimé du sprint "${sprint.sprintName}".`, "Devellopeurs");
    await project.save();

    res.json({ message: 'Ticket deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});





// Supprimer un bug pour un ticket donné
router.delete('/delete-bug/:projectId/:sprintId/:ticketId', async (req, res) => {
  try {
    const { projectId, sprintId, ticketId } = req.params;
    const { nameActor, email } = req.body;

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
    await project.addRecentActivity(nameActor, email, `Deleted the bug for the ticket #Tk-${ticket.numTicket}  "${ticket.ticketInfo}"`);
    await teamNotificationController.saveTeamNotification(project.projectAssignedTeams ,email, nameActor, `Deleted the bug for the ticket #Tk-${ticket.numTicket}  "${ticket.ticketInfo}"`, "Devellopeurs");
    await project.save();
   
    res.json({ message: 'Bug deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});





// Supprimer une sortie spécifique d'un ticket
router.delete('/delete-output/:projectId/:sprintId/:ticketId/:outputId', async (req, res) => {
  try {
    const { projectId, sprintId, ticketId, outputId } = req.params;
    const { nameActor, email } = req.body;

    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ message: "Projet non trouvé" });
    }

    const sprint = project.sprints.id(sprintId);

    if (!sprint) {
      return res.status(404).json({ message: "Sprint non trouvé" });
    }

    const ticket = sprint.tickets.id(ticketId);

    if (!ticket || !ticket.outputs || ticket.outputs.length === 0) {
      return res.status(404).json({ message: "Aucune capture d'écran trouvée pour ce ticket" });
    }

    const outputIndex = ticket.outputs.findIndex(output => output._id.toString() === outputId);

    if (outputIndex === -1) {
      return res.status(404).json({ message: "Capture d'écran non trouvée pour cet ID" });
    }

    // Supprimer la capture d'écran du tableau des outputs
    const deletedOutput = ticket.outputs.splice(outputIndex, 1);

    // Enregistrer les modifications
    await project.addRecentActivity(nameActor, email, `Deleted an output for the ticket #Tk-${ticket.numTicket} "${ticket.ticketInfo}"`);
    await teamNotificationController.saveTeamNotification(project.projectAssignedTeams ,email, nameActor, `Deleted an output for the ticket #Tk-${ticket.numTicket} "${ticket.ticketInfo}"`, "Devellopeurs");
    await project.save();

    res.json({ message: "Capture d'écran supprimée avec succès", deletedOutput });
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





//route deleteeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee













//// edns Action 

//get-recent activities



module.exports = router;

// Exporter le routeur


