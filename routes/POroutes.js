const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const ProductOwner = require('../models/Po');
const ScrumMaster = require('../models/SM');
const Developer =require('../models/User')  
const Team = require('../models/Teams');
const { generateJWTToken } = require('../utils/authUtils');
const { isValidPassword } = require('../utils/Verifier');
const { LocalStorage } = require('node-localstorage');
const localStorage = new LocalStorage('./scratch');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const DailyScrum=require("../models/dailyScrum");

const DayRoutine = require('../models/dayRoutine');
const  Project = require('../models/Projet');
const { handleSignIn, handleSignOut }= require('../utils/attendanceController');
const teamNotificationController = require('../utils/notificatioCont');

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
        const authorizedCodes = ['123456', '654321', '852741', '963852'];
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
    

router.post('/signout', async (req, res) => {
  try {
    const { developerId } = req.body;
    const role = "Product Owner";
    
    // Récupérer le Product Owner associé au développeur
    const productOwner =  await ProductOwner.findById(developerId);

    if (!productOwner) {
      return res.status(404).json({ message: 'Product Owner not found' });
    }

    // Récupérer le nom et l'email du Product Owner
    const { nom, email } = productOwner;

    // Traiter la déconnexion pour le développeur
    await handleSignOut(developerId, role);

    // Enregistrer la notification pour le Product Owner
    await teamNotificationController.saveNotificationForProductOwner(developerId, email, nom, "a Déconnecté", "ProductOwners");

    res.status(200).json({ message: 'Déconnexion réussie' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


  
// Route pour la connexion d'un ScrumMaster
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
      
      await handleSignIn(user._id,"Product Owner");
      const id=user._id;
      const name=user.nom+" "+user.prenom;
      await teamNotificationController.saveNotificationForProductOwner(user._id, email, name, "a Connecté","ProductOwners");
      res.status(200).json({ token,id,name,email });
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
      const newUser = await ProductOwner.findOne({ email });

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
      const newUser= await ProductOwner.findOne({ email });

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
  


// Configuration du stockage Multer pour les fichiers téléchargés
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
    const PO = await ProductOwner.findOne({ email });

    if (!PO) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    // Vérifier si une nouvelle photo a été téléchargée
    if (!req.file) {
      return res.status(400).json({ message: "Aucune photo téléchargée" });
    }

    // Mettre à jour les informations de la photo de profil
     // Mettre à jour le chemin de la photo de profil dans le document de l'utilisateur
     PO.profileInfo.photo = req.file.filename;

     await teamNotificationController.saveNotificationForProductOwner(PO._id, email,PO.nom, "A modifier le photo de profile ", "ProductOwners");
    // Sauvegarder les modifications dans la base de données
    await PO.save();

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
    const PO = await ProductOwner.findOne({ email });

    if (!PO || !PO.profileInfo.photo) {
      return res.status(404).json({ message: "Photo de profil non trouvée" });
    }

    // Construire le chemin absolu vers le fichier image
    const imagePath = path.join(__dirname, '..', 'assets', PO.profileInfo.photo);

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

router.put('/updatePersonalInfo/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const { nationality, emergencyNumber, gmail, etat } = req.body;

    // Recherche du développeur par e-mail
    const developer = await ProductOwner.findOneAndUpdate(
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

// Ajouter une route pour ajouter une nouvelle expérience
router.post('/add-experience', async (req, res) => {
  try {
    // Récupérer l'e-mail du développeur depuis le corps de la requête
    const { email } = req.body;

    // Récupérer les données de la nouvelle expérience depuis le corps de la requête
    const { title, company, startDate, endDate, description } = req.body;

    // Vérifier si le développeur existe dans la base de données
    const PO = await ProductOwner.findOne({ email });
    if (!PO) {
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
    PO.experiences.push(newExperience);

    // Sauvegarder les modifications dans la base de données
    await PO.save();

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
    const PO= await ProductOwner.findOne({ email });
    if (!PO) {
      return res.status(404).json({ message: 'Développeur non trouvé' });
    }

    // Récupérer les expériences du développeur
    const experiences = PO.experiences;

    // Répondre avec les expériences récupérées
    res.status(200).json({ experiences });
  } catch (error) {
    // Gérer les erreurs
    res.status(500).json({ message: error.message });
  }
});


router.get('/get-teams/:emailPo', async (req, res) => {
  try {
    const emailPo = req.params.emailPo;
    // Trouver le Product Owner correspondant à l'emailPo
    const productOwner = await ProductOwner.findOne({ email: emailPo });

    if (!productOwner) {
      return res.status(404).json({ message: "Product Owner not found for the provided email" });
    }

    // Récupérer l'ID du Product Owner
    const poId = productOwner._id;

    // Trouver les équipes dont le Product Owner correspond à poId
    let teams = await Team.find({ productOwner: poId })
      .populate({
        path: 'developer',
        select: 'email nom'
      })
      .populate('scrumMaster', 'email nom')
      .populate('productOwner', 'email nom')
      .select('-__v');

    const updatedTeams = [];

    for (const team of teams) {
      // Mise à jour du nombre total de projets
      team.totalProjects = team.projects.length;

      if (team.scrumMaster && team.productOwner && team.developer.length >= 1) {
        updatedTeams.push(team);
      } else {
        console.log(`Suppression de l'équipe car elle ne satisfait pas aux critères: ${team.name}`);
        await Team.findOneAndDelete({ _id: team._id });
      }
    }

    res.status(200).json(updatedTeams);
  } catch (error) {
    console.error('Erreur lors de la récupération des équipes :', error);
    res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des équipes' });
  }
});


// Route pour récupérer les membres d'une équipe spécifique
router.get('/get-team-members/:teamId', async (req, res) => {
  try {
    const teamId = req.params.teamId;
    const team = await Team.findById(teamId)
      .populate('productOwner', 'nom email')
      .populate('scrumMaster', 'nom email')
      .populate('developer', 'nom email');

    if (!team) {
      return res.status(404).json({ message: 'Équipe non trouvée' });
    }

    res.status(200).json({
      productOwner: team.productOwner,
      scrumMaster: team.scrumMaster,
      developers: team.developer
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des membres de l\'équipe :', error);
    res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des membres de l\'équipe' });
  }
});

// Ajouter un développeur à une équipe existante
router.post('/add-developer', async (req, res) => {
  try {
    const { teamId, developerEmail } = req.body;

    // Vérifier si l'équipe existe
    const team = await Team.findById(teamId);
    const productOwner =  await ProductOwner.findById(team.productOwner);
    if (!team) {
      return res.status(404).json({ message: 'Équipe non trouvée' });
    }

    // Vérifier si le développeur existe
    const developer = await Developer.findOne({ email: developerEmail });
    if (!developer) {
      return res.status(404).json({ message: 'Développeur non trouvé' });
    }

    // Vérifier si le développeur est déjà dans une équipe
    const existingTeam = await Team.findOne({ developer: developer._id });
    if (existingTeam) {
      return res.status(400).json({ message: 'Le développeur est déjà dans une équipe' });
    }

    // Ajouter l'ID de l'équipe assignée pour le développeur
    developer.assignedTeams = teamId;
    await developer.save();

    // Ajouter le développeur à l'équipe
    team.developer.push(developer._id);
    team.numberOfMembers += 1;

    const projectId = team.projects[0].projectId;

    // Ajouter l'ID du projet au tableau assignedProjects du développeur
    developer.assignedProjects.addToSet(projectId);

    // Enregistrer les modifications du développeur
    await developer.save();
    await teamNotificationController.saveTeamNotification(team._id  ,productOwner.email,productOwner.nom, `A Ajouetr le dev  ${developer.nom} ${developer.prenom} `, "ProductOwners");  
    // Enregistrer les modifications de l'équipe
    await team.save();

    // Répondre avec un message de succès
    res.status(200).json({ message: 'Développeur ajouté à l\'équipe avec succès' });
  } catch (error) {
    console.error('Erreur lors de l\'ajout du développeur à l\'équipe :', error);
    res.status(500).json({ message: 'Une erreur est survenue lors de l\'ajout du développeur à l\'équipe' });
  }
});

router.post('/create-team', async (req, res) => {
  try {
    const { name, productOwnerEmail, developerEmails, scrumMasterEmail, workType } = req.body;

    // Vérifier si le Product Owner existe
    const productOwner = await ProductOwner.findOne({ email: productOwnerEmail });
    if (!productOwner) {
      return res.status(400).json({ message: 'Product Owner non trouvé' });
    }

    // Vérifier si le Scrum Master existe
    const scrumMaster = await ScrumMaster.findOne({ email: scrumMasterEmail });
    if (!scrumMaster) {
      return res.status(400).json({ message: 'Scrum Master non trouvé' });
    }

    // Vérifier si le Scrum Master est déjà dans une équipe
    const existingTeamWithScrumMaster = await Team.findOne({ scrumMaster: scrumMaster._id });
    if (existingTeamWithScrumMaster) {
      return res.status(400).json({ message: 'Le Scrum Master est déjà dans une équipe' });
    }

    // Vérifier si les développeurs existent et compter leur nombre
    const developers = await Developer.find({ email: { $in: developerEmails } });
    const numberOfMembers = developers.length;

    // Vérifier si les développeurs sont déjà dans une équipe
    for (const developer of developers) {
      const existingTeam = await Team.findOne({ developer: developer._id });
      if (existingTeam) {
        return res.status(400).json({ message: 'Le développeur ' + developer.email + ' est déjà dans une équipe' });
      }
    }
    
    // Créer une nouvelle équipe
    const newTeam = await Team.create({
      name,
      productOwner: productOwner._id,
      developer: developers.map(dev => dev._id),
      scrumMaster: scrumMaster._id,
      numberOfMembers,
      workType
    });

    // Mettre à jour les utilisateurs avec l'ID de la nouvelle équipe
    const usersToUpdate = [...developers, scrumMaster, productOwner];
    for (const user of usersToUpdate) {
      // Initialiser assignedTeams si elle est undefined
      if (!user.assignedTeams) {
        user.assignedTeams = [];
      }
      user.assignedTeams.push(newTeam._id);
      await user.save(); // Enregistrer les modifications dans la base de données
    }

    // Créer un DailyScrum par défaut pour la nouvelle équipe
   

    res.status(201).json(newTeam);
  } catch (error) {
    console.error(error); // Afficher l'erreur dans la console
    res.status(500).json({ message: 'Une erreur est survenue lors de la création de l\'équipe', error: error.message });
  }
});



router.get('/get-team/:id', async (req, res) => {
  const teamId = req.params.id;

  try {
    const team = await Team.findById(teamId)
      .populate({
        path: 'developer',
        select: 'email nom'
      })
      .populate('scrumMaster', 'email nom')
      .populate('productOwner', 'email nom')
      .select('-__v');

    if (!team) {
      return res.status(404).json({ message: 'Équipe non trouvée' });
    }

    // Vérifier si l'équipe satisfait aux critères
    if (!(team.scrumMaster && team.productOwner && team.developer.length >= 1)) {
      console.log(`Suppression de l'équipe car elle ne satisfait pas aux critères: ${team.name}`);
      await Team.findOneAndDelete({ _id: team._id });
      return res.status(404).json({ message: 'Équipe supprimée car elle ne satisfait pas aux critères' });
    }

    res.status(200).json(team);
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'équipe :', error);
    res.status(500).json({ message: 'Une erreur est survenue lors de la récupération de l\'équipe' });
  }
});


router.delete('/remove-member', async (req, res) => {
  try {
    const { teamId, memberId, memberRole } = req.body;

    // Vérifier si l'équipe existe
    const team = await Team.findById(teamId);
    const productOwner =  await ProductOwner.findById(team.productOwner);
    if (!team) {
      return res.status(404).json({ message: 'Équipe non trouvée' });
    }

    let role;

    // Vérifier le rôle du membre
    switch (memberRole) {
      case 'developer':
        role = 'développeur';
        break;
      case 'scrumMaster':
        role = 'Scrum Master';
        break;
      default:
        return res.status(400).json({ message: 'Rôle de membre invalide' });
    }

    // Si le membre est un développeur, supprimer tous les tickets associés à ce développeur
    if (memberRole === 'developer') {
      // Récupérer l'email du développeur
      const developer = await Developer.findById(memberId);
      await teamNotificationController.saveTeamNotification(team._id ,productOwner.email,productOwner.nom, ` à Supprimer le  Developeur   ${developer.nom} ${developer.prenom} de team `, "ProductOwners");  
      if (!developer) {
        return res.status(404).json({ message: 'Développeur non trouvé' });
      }
      const developerEmail = developer.email;
    
      // Parcourir tous les projets de l'équipe et supprimer les tickets associés au développeur
      await Promise.all(team.projects.map(async (project) => {
        const assignedProject = await Project.findById(project.projectId);
        if (assignedProject) {
          await assignedProject.deleteTicketsByEmail(developerEmail);
        }
      }));

      // Supprimer la référence du projet assigné dans assignedProjects du développeur
      await Developer.updateOne({ _id: memberId }, { $pull: { assignedProjects: { $in: team.projects.map(p => p.projectId) } } });
    }

    // Si le membre est un développeur ou un Scrum Master, mettre à jour assignedTeams
    if (memberRole === 'developer' || memberRole === 'scrumMaster') {
      const Model = memberRole === 'developer' ? Developer : ScrumMaster;
      // Supprimer l'équipe de l'attribut assignedTeams
      await Model.updateOne({ _id: memberId }, { $pull: { assignedTeams: teamId } });
    }
    
    // Supprimer le membre de l'équipe
    team[memberRole].pull(memberId); 
    
    team.numberOfMembers -= 1;
   
    // Enregistrer les modifications dans la base de données
    await team.save();

    // Répondre avec un message de succès
    res.status(200).json({ message: `${role} supprimé de l'équipe avec succès` });
  } catch (error) {
    console.error('Erreur lors de la suppression du membre de l\'équipe :', error);
    res.status(500).json({ message: 'Une erreur est survenue lors de la suppression du membre de l\'équipe' });
  }
});

router.delete('/delete-team/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;

    // Vérifier si l'équipe existe
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: 'Équipe non trouvée' });
    }
   await teamNotificationController.deleteNotificationsForTeam(teamId)   ;
    // Trouver les projets associés à cette équipe
    const projects = await Project.find({ projectAssignedTeams: teamId });

    // Collecter les IDs des projets associés
    const projectIds = projects.map(project => project._id);

    // Supprimer les projets associés
    await Project.deleteMany({ projectAssignedTeams: teamId });

    // Supprimer l'équipe
    await Team.findByIdAndDelete(teamId);

    // Retirer l'équipe des utilisateurs concernés (développeurs et Scrum Master)
    await Promise.all([
      Developer.updateMany({ assignedTeams: teamId }, { $pull: { assignedTeams: teamId } }),
      ScrumMaster.updateMany({ assignedTeams: teamId }, { $pull: { assignedTeams: teamId } }),
      ProductOwner.updateMany({ assignedTeams: teamId }, { $pull: { assignedTeams: teamId } })
    ]);

    // Retirer les projets associés des développeurs et des Scrum Masters
    await Promise.all([
      Developer.updateMany({ assignedProjects: { $in: projectIds } }, { $pull: { assignedProjects: { $in: projectIds } } }),
      ScrumMaster.updateMany({ assignedProjects: { $in: projectIds } }, { $pull: { assignedProjects: { $in: projectIds } } })
    ]);

    // Répondre avec un message de succès
    res.status(200).json({ message: 'Équipe et projets associés supprimés avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'équipe :', error);
    res.status(500).json({ message: 'Une erreur est survenue lors de la suppression de l\'équipe' });
  }
});

// Définir une route pour récupérer les développeurs sans équipe assignée
router.get('/developers-without-team', async (req, res) => {
  try {
    // Rechercher les développeurs sans équipe assignée
    const developersWithoutTeam = await Developer.find({ assignedTeams: { $exists: true, $size: 0 } })
      .select('nom prenom email') // Sélectionner les champs à retourner
      .lean(); // Convertir en objet JavaScript pur

    // Répondre avec la liste des développeurs sans équipe assignée
    res.status(200).json(developersWithoutTeam);
  } catch (error) {
    console.error('Erreur lors de la récupération des développeurs sans équipe assignée :', error);
    res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des développeurs sans équipe assignée' });
  }
});

router.put('/update-team/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { name, workType } = req.body;

    // Vérifier si l'équipe existe
    const team = await Team.findById(teamId);
    const productOwner = await ProductOwner.findById(team.productOwner);
    if (!team) {
      return res.status(404).json({ message: 'Équipe non trouvée' });
    }

    // Stocker le type d'action
    let actionType = '';

    // Vérifier et mettre à jour le nom de l'équipe si un nouveau nom est fourni
    if (name) {
      actionType += 'Nom ';
      team.name = name;
    }

// Vérifier si le nom et/ou le type de travail ont été modifiés
let notificationMessage = '';
if (name && workType) {
  notificationMessage = `L'équipe a été mise à jour: Nom '${name}' et Type de travail '${workType}'`;
} else if (name) {
  notificationMessage = `L'équipe a été mise à jour: Nom '${name}'`;
} else if (workType) {
  notificationMessage = `L'équipe a été mise à jour: Type de travail '${workType}'`;
}

// Enregistrer la notification
await teamNotificationController.saveTeamNotification(teamId, productOwner.email, productOwner.nom, notificationMessage, "ProductOwners");


    // Enregistrer les modifications dans la base de données
    await team.save();

    // Envoyer la notification au Product Owner
  

    // Répondre avec un message de succès et les données de l'équipe mise à jour
    res.status(200).json({ message: 'Équipe mise à jour avec succès', team });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'équipe :', error);
    res.status(500).json({ message: 'Une erreur est survenue lors de la mise à jour de l\'équipe' });
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







router.get('/get-Projects/:emailPo', async (req, res) => {
  try {
    const { emailPo } = req.params;
    if (!emailPo) {
      return res.status(400).json({ message: "L'e-mail du Product Owner est requis dans le corps de la requête" });
    }

    const projects = await Project.find({ emailPo }).populate('projectAssignedTeams');

    if (!projects || projects.length === 0) {
      return res.status(404).json({ message: 'Aucun projet trouvé pour cet e-mail de Product Owner', progress: 0 });
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
        progress: progress.toFixed(0)

      };
    }));

    res.status(200).json(projectsWithTeamInfo);
  } catch (error) {
    console.error('Erreur lors de la récupération des projets :', error);
    res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des projets' });
  }
});



// Route pour récupérer uniquement les noms et les IDs de tous les projets
router.get('/projects/names-ids/:emailPo', async (req, res) => {
  try {
    const { emailPo } = req.params;

      // Récupérer uniquement le nom et l'ID de tous les projets
      const projects = await Project.find({emailPo:emailPo}, { projectName: 1, _id: 1 });

      res.json(projects); // Renvoie les projets au format JSON
  } catch (error) {
      console.error('Erreur lors de la récupération des noms et des IDs des projets :', error);
      res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des noms et des IDs des projets' });
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
      const SCM = await ProductOwner.findOne({ email });
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
      const SCM = await ProductOwner.findOne({ email });
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



router.post('/create-Project', upload.fields([{ name: 'userStories', maxCount: 5 }, { name: 'productBacklog', maxCount: 5 }]), async (req, res) => {
  try {
    const {
      projectName,
      projectStartDate,
      projectCategory,
      projectEndDate,
      ClientName,
    
      projectAssignedTeams,
      budget,
      priority,
      description,
      emailPo // Ajout de l'email du Product Owner
    } = req.body;
 
    // Récupérer les noms de fichiers téléchargés pour les histoires utilisateur et le backlog produit
    const userStories = req.files['userStories'].map(file => file.filename);
    const productBacklog = req.files['productBacklog'].map(file => file.filename);

    // Créer le projet
    const newProject = await Project.create({
      projectName,
      userStories,
      projectCategory,
      ClientName,
      Delivered:false,
      productBacklog,
      projectAssignedTeams,
      projectStartDate,
      projectEndDate,
      budget,
      priority,
      description,
      emailPo
    });
    
    const user = await ProductOwner.findOne({ email: emailPo });
    await teamNotificationController.saveTeamNotification(projectAssignedTeams,user.email,user.nom, `Assigné une projet A team  ${newProject.projectName}`, "ProductOwners");
    await DailyScrum.createWithDefaultsByTeamId(projectAssignedTeams, newProject._id);

    // Mettre à jour le document de l'équipe
    await Team.findOneAndUpdate(
      { _id: projectAssignedTeams },
      {
        $push: {
          projects: {
            projectName: projectName,
            projectId: newProject._id
          }
        },
        $inc: { totalProjects: 1 }
      }
    );

    // Mettre à jour les développeurs de l'équipe assignée
    await Developer.updateMany(
      { assignedTeams: projectAssignedTeams },
      {
        $push: { assignedProjects: newProject._id }
      }
    );

    // Mettre à jour les développeurs qui n'ont pas de projet attribué
    await ScrumMaster.updateMany(
      { assignedTeams: projectAssignedTeams },
      {
        $push: { assignedProjects: newProject._id }
      }
    );



    res.status(201).json(newProject);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ message: 'An error occurred while creating the project' });
  }
});

router.put('/update-Project/:projectId', upload.fields([{ name: 'userStories', maxCount: 5 }, { name: 'productBacklog', maxCount: 5 }]), async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const {
      projectName,
      projectStartDate,
      projectCategory,
      ClientName,
      projectEndDate,
      projectAssignedTeams,
      budget,
      priority,
      description,
    } = req.body;

    // Récupérer les noms de fichiers téléchargés pour les histoires utilisateur et le backlog produit
    const userStories = req.files['userStories'] ? req.files['userStories'].map(file => file.filename) : [];
    const productBacklog = req.files['productBacklog'] ? req.files['productBacklog'].map(file => file.filename) : [];

    // Vérifier si l'équipe actuelle existe
    const newTeam = await Team.findById(projectAssignedTeams);
    if (!newTeam) {
      return res.status(404).json({ message: 'La nouvelle équipe assignée n\'a pas été trouvée' });
    }

    // Trouver le projet à mettre à jour
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Projet non trouvé' });
    }

    // Si le projet a déjà une équipe assignée, supprimer le projet de cette équipe
    if (project.projectAssignedTeams) {
      const oldTeam = await Team.findById(project.projectAssignedTeams);
      if (oldTeam) {
        oldTeam.projects = oldTeam.projects.filter(p => p.projectId.toString() !== projectId);
        await oldTeam.save();
        
        // Supprimer le projet des développeurs de l'équipe précédente
        await Developer.updateMany(
          { assignedTeams: oldTeam._id },
          { $pull: { assignedProjects: projectId } }
        );

        // Supprimer le projet du scrum master de l'équipe précédente
        await ScrumMaster.updateOne(
          { assignedTeams: oldTeam._id },
          { $pull: { assignedProjects: projectId } }
        );
      }
    }

    const Po = await ProductOwner.findById(newTeam.productOwner);
    // Ajouter le projet à la nouvelle équipe assignée
    newTeam.projects.push({ projectId: projectId, projectName: projectName });
    await teamNotificationController.saveTeamNotification(newTeam._id ,project.emailPo,Po.nom, `à Modifier le Projet Assigné ${project.projectName} de team `, "ProductOwners");  
    await newTeam.save();

    // Mettre à jour le projet avec les champs modifiés
    const updateFields = {
      projectName,
      projectCategory,
      projectStartDate,
      ClientName,
      projectEndDate,
      projectAssignedTeams: newTeam._id, // Utiliser l'ID de la nouvelle équipe
      budget,
      priority,
      description,
    };

    // Ajouter les champs userStories et productBacklog seulement si des fichiers ont été sélectionnés
    if (userStories.length > 0) {
      updateFields.userStories = userStories;
    }

    if (productBacklog.length > 0) {
      updateFields.productBacklog = productBacklog;
    }

    // Mettre à jour le projet avec les champs modifiés
    const updatedProject = await Project.findByIdAndUpdate(projectId, updateFields, { new: true });

    // Mettre à jour les développeurs de la nouvelle équipe avec le projet assigné
    await Developer.updateMany(
      { assignedTeams: newTeam._id },
      { $addToSet: { assignedProjects: projectId } } // Utiliser $addToSet pour éviter les doublons
    );

    // Mettre à jour le scrum master de la nouvelle équipe avec le projet assigné
    await ScrumMaster.updateOne(
      { assignedTeams: newTeam._id },
      { $addToSet: { assignedProjects: projectId } } // Utiliser $addToSet pour éviter les doublons
    );

    res.status(200).json(updatedProject);
  } catch (error) {
    console.error('Erreur lors de la mise à jour du projet :', error);
    res.status(500).json({ message: 'Une erreur est survenue lors de la mise à jour du projet' });
  }
});

router.delete('/delete-Project/:projectId', async (req, res) => {
  try {
    const projectId = req.params.projectId;

    // Chercher le projet à supprimer
    const deletedProject = await Project.findById(projectId);

    // Vérifier si le projet existe
    if (!deletedProject) {
      return res.status(404).json({ message: 'Projet non trouvé' });
    }

    // Vérifier s'il y a une équipe assignée à ce projet
    if (deletedProject.projectAssignedTeams) {
      // Rechercher l'équipe assignée par son ID
      const assignedTeam = await Team.findById(deletedProject.projectAssignedTeams);

      // Si l'équipe est trouvée, supprimer le projet de sa liste de projets assignés
      if (assignedTeam) {
        assignedTeam.projects = assignedTeam.projects.filter(project => project.projectId.toString() !== projectId);
        await assignedTeam.save();
      }
    }

    // Rechercher le Product Owner par email
    const po = await ProductOwner.findOne({ email: deletedProject.emailPo });

    // Vérifier si le Product Owner est trouvé et passer les informations correctes pour la notification
    if (po) {
      await teamNotificationController.saveTeamNotification(
        deletedProject.projectAssignedTeams,
        po.email,
        po.nom,
        `A supprimé le projet assigné ${deletedProject.projectName} de l'équipe`,
        "ProductOwners"
      );
    }

    // Supprimer le projet
    await Project.deleteOne({ _id: projectId });

    // Retirer le projet des développeurs assignés
    await Developer.updateMany(
      { assignedProjects: projectId },
      { $pull: { assignedProjects: projectId } }
    );

    res.status(200).json({ message: 'Projet supprimé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression du projet :', error);
    res.status(500).json({ message: 'Une erreur est survenue lors de la suppression du projet' });
  }
});

router.put('/isDelivered/:projectId', async (req, res) => {
  try {
    const projectId = req.params.projectId;

    // Trouver le projet à mettre à jour
    const project = await Project.findById(projectId);

    // Vérifier si le projet existe
    if (!project) {
      return res.status(404).json({ message: 'Projet non trouvé' });
    }

    // Mettre à jour l'état du projet à "Delivered=true"
    project.Delivered = true;
    await project.save();

    res.status(200).json({ message: 'État du projet mis à jour avec succès', project });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'état du projet :', error);
    res.status(500).json({ message: 'Une erreur est survenue lors de la mise à jour de l\'état du projet' });
  }
});


router.get('/get-files/:projectId', async (req, res) => {
  try {
    const projectId = req.params.projectId;

    // Récupérer le projet par son ID
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ message: 'Projet non trouvé' });
    }

    // Récupérer les noms de fichiers des User Stories et du Product Backlog
    const userStories = project.userStories;
    const productBacklog = project.productBacklog;

    // Envoyer les fichiers en tant que téléchargement
    res.status(200).json({ userStories, productBacklog });
  } catch (error) {
    console.error('Erreur lors du téléchargement des fichiers :', error);
    res.status(500).json({ message: 'Une erreur est survenue lors du téléchargement des fichiers' });
  }
});

const mime = require('mime-types');

// Endpoint pour télécharger un fichier
router.get('/download/:filename', function(req, res) {
  // Récupérer le nom de fichier depuis la requête
  const filename = req.params.filename;
  // Récupérer l'extension du fichier
  const fileExtension = path.extname(filename);

  // Définir le chemin complet du fichier à télécharger
  const filePath = path.join(__dirname, '../assets/', filename);


  // Vérifier si le fichier existe
  if (fs.existsSync(filePath)) {
      // Obtenir le type MIME en fonction de l'extension du fichier
      const contentType = mime.contentType(fileExtension) || 'application/octet-stream';

      // Envoyer le fichier en réponse avec le bon type de contenu
      res.setHeader('Content-disposition', 'attachment; filename=' + filename);
      res.setHeader('Content-type', contentType);
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
  } else {
      // Le fichier n'existe pas, renvoyer une réponse 404
      res.status(404).send('Fichier non trouvé');
  }
});

router.get('/developers-and-scrum-masters', async (req, res) => {
  try {
    // Récupérer tous les membres qui sont développeurs
    const developers = await Developer.find();

    // Récupérer tous les membres qui sont Scrum Masters
    const scrumMasters = await ScrumMaster.find();
    
    // Envoyer la liste des développeurs et des Scrum Masters en réponse
    res.status(200).json({ developers, scrumMasters });
  } catch (error) {
    console.error('Erreur lors de la récupération des membres développeurs et Scrum Masters :', error);
    res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des membres développeurs et Scrum Masters' });
  }
});

router.post('/add-holidays/:emailPo', async (req, res) => {
  try {
    const emailPo = req.params.emailPo;
    const po = await ProductOwner.findOne({ email: emailPo });

    if (!po) {
      return res.status(404).json({ message: 'Product Owner not found' });
    }

    let teamIds = req.body.teamIds;
    let teamNames = req.body.teamNames;

    // If "All Teams" option is selected, get all team IDs and names
    if (req.body.isAllTeams) {
      const teams = await Team.find();
      teamIds = teams.map(team => team._id);
      teamNames = teams.map(team => team.name);
    }

    const holiday = {
      name: req.body.name,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      teamIds,
      teamNames
    };

    // Add the holiday to each relevant team
    for (const teamId of teamIds) {
      await teamNotificationController.saveTeamNotification(
        teamId,
        po.email,
        po.nom,
        `A ajouté un événement ${holiday.name} pour l'équipe à partir de ${holiday.startDate} jusqu'à ${holiday.endDate}`,
        "ProductOwners"
      );
      await Team.findByIdAndUpdate(teamId, { $push: { holidays: holiday } });

      // Save the notification for each team
     
    }

    res.status(201).json({ message: 'Holiday added successfully' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update Holidays Route
router.put('/update-holidays/:teamId/:holidayId/:emailPo', async (req, res) => {
  try {
    const { teamId, holidayId, emailPo } = req.params;
    const updatedHolidayData = {
      name: req.body.name,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      teamIds: req.body.teamIds,
      teamNames: req.body.teamNames
    };

    const po = await ProductOwner.findOne({ email: emailPo });

    if (!po) {
      return res.status(404).json({ message: 'Product Owner not found' });
    }

    const team = await Team.findOneAndUpdate(
      { _id: teamId, "holidays._id": holidayId },
      { $set: { "holidays.$": updatedHolidayData } },
      { new: true }
    );

    if (!team) {
      return res.status(404).json({ message: "Holiday not found" });
    }

    // Send notification for the update
    await teamNotificationController.saveTeamNotification(
      teamId,
      po.email,
      po.nom,
      `A mis à jour l'événement ${updatedHolidayData.name} pour l'équipe à partir de ${updatedHolidayData.startDate} jusqu'à ${updatedHolidayData.endDate}`,
      "ProductOwners"
    );

    res.json(team);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});



router.delete('/delete-holidays/:teamId/:holidayId/:emailPo', async (req, res) => {
  try {
    const { teamId, holidayId, emailPo } = req.params;

    const po = await ProductOwner.findOne({ email: emailPo });

    if (!po) {
      return res.status(404).json({ message: 'Product Owner not found' });
    }

    const team = await Team.findByIdAndUpdate(
      teamId,
      { $pull: { holidays: { _id: holidayId } } },
      { new: true }
    );

    

    if (!team) {
      return res.status(404).json({ message: "Holiday not found" });
    }

    const deletedHoliday = team.holidays.find(holiday => holiday._id.toString() === holidayId);
    await teamNotificationController.saveTeamNotification(
      teamId,
      po.email,
      po.nom,
      `A supprimé l'événement  pour l'équipe ${team.name}`,
      "ProductOwners"
    );

    res.json({ message: 'Holiday deleted successfully' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});




// Lire toutes les journées de routine
router.get('/get-journees', async (req, res) => {
  try {
    const dayRoutines = await DayRoutine.find();
    res.send(dayRoutines);
  } catch (error) {
    res.status(500).send(error);
  }
});

router.put('/update-journee/:id/:emailPo', async (req, res) => {
  try {
    const { punchinTime, punchoutTime, breackTime, halfDay, fullDay, overTime, total } = req.body;
    
    const po=await ProductOwner.findOne({ email: req.params.emailPo});

    const updatedRoutine = await DayRoutine.findByIdAndUpdate(req.params.id, {
      punchinTime,
      punchoutTime,
      breackTime,
      halfDay,
      fullDay,
      overTime,
      total
    }, { new: true });

    await teamNotificationController.saveNotificationForProductOwner(
     po._id,
      po.email,
      po.nom,
      `A modifer le DayRoutine de jour  ${updatedRoutine.jour}  `,
      "ProductOwners"
    );

    res.json(updatedRoutine);
  } catch (err) {
    res.status(400).json({ message: err.message });
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

router.get('/get-project/:id', async (req, res) => {
  const projectId = req.params.id;

  try {
      // Recherchez le projet par son ID dans la base de données
      const project = await Project.findById(projectId);

      if (!project) {
          return res.status(404).json({ message: 'Projet non trouvé' });
      }

      // Si le projet est trouvé, renvoyez-le en tant que réponse
      res.json(project);
  } catch (error) {
      console.error('Erreur lors de la récupération des détails du projet :', error);
      res.status(500).json({ message: 'Erreur lors de la récupération des détails du projet' });
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
    const developer = await Developer.findOne({ email: emailDeveloppeur });
    if (!developer) throw new Error('Developer not found');

    const project = await Project.findById(projectId);
    const sprint = project.sprints.id(sprintId);
    sprint.tickets.push({ ...req.body, noSprint: sprint.sprintNumber });
    await project.save();
    res.json(req.body);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Récupérer tous les tickets d'un sprint donné
router.get('/get-s-tickets/:projectId/:sprintId', async (req, res) => {
  try {
    const { projectId, sprintId } = req.params;
    const project = await Project.findById(projectId);

    if (!project) {
      // Si le projet n'est pas trouvé, renvoyer une réponse vide
      return res.json([]);
    }

    const sprint = project.sprints.id(sprintId);
    if (!sprint) {
      // Si le sprint n'est pas trouvé, renvoyer une réponse vide
      return res.json([]);
    }
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


router.delete('/removeMember/:userId', async (req, res) => {
  const { userId } = req.params;

  try {

      // Vérifier si l'utilisateur à supprimer est un développeur
      const isDeveloper = await Developer.findOne({ _id: userId });
      if (isDeveloper) {
          // Supprimer le développeur
          await Developer.findByIdAndDelete(userId);
          return res.status(200).json({ message: "Le développeur a été supprimé avec succès." });
      }

      // Vérifier si l'utilisateur à supprimer est un Scrum Master
      const isScrumMaster = await ScrumMaster.findOne({_id: userId });
      if (isScrumMaster) {
          // Supprimer le Scrum Master
          await ScrumMaster.findByIdAndDelete(userId);
          return res.status(200).json({ message: "Le Scrum Master a été supprimé avec succès." });
      }

      return res.status(404).json({ message: "L'utilisateur spécifié n'est ni un développeur ni un Scrum Master." });
  } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Une erreur s'est produite lors de la suppression de l'utilisateur." });
  }
});
//Etat membres 



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
    const developer = await ProductOwner.findById(developerId);

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













//dashboardddddddddddddddddddddddddd

/*//// des dev et scm   par les memebres {
    "developers": 5,
    "scrumMasters": 2
}*/
router.get('/roles-distribution', async (req, res) => {
  try {
      const developerCount = await Developer.countDocuments();
      const scrumMasterCount = await ScrumMaster.countDocuments();

      res.json({
          developers: developerCount,
          scrumMasters: scrumMasterCount
      });
  } catch (error) {
      res.status(500).json({ message: 'Erreur serveur', error });
  }
});

/*/////presence de chaque jours de annes current  {
        "date": "2024-05-28",
        "attendancePercentage": 0
    },*/

    router.get('/annual-attendance', async (req, res) => {
      try {
          // Obtenir les données de présence de tous les développeurs et Scrum Masters
          const developers = await Developer.find({}, 'attendanceData');
          const scrumMasters = await ScrumMaster.find({}, 'attendanceData');
  
          // Fusionner les données de présence
          const attendanceData = [...developers, ...scrumMasters];
  
          // Calculer le nombre total d'employés
          const totalEmployees = developers.length + scrumMasters.length;
  
          // Fonction pour générer un tableau de jours pour un mois donné
          const getDaysInMonth = (month, year) => {
              let date = new Date(year, month, 1);
              let days = [];
              while (date.getMonth() === month) {
                  days.push(new Date(date));
                  date.setDate(date.getDate() + 1);
              }
              return days;
          };
  
          // Obtenir l'année courante et la date actuelle
          const now = new Date();
          const year = now.getFullYear();
          const today = new Date(now.toISOString().split('T')[0]);
  
          // Initialiser un objet pour stocker les résultats par mois
          let results = {};
  
          // Parcourir chaque mois de l'année
          for (let month = 0; month < 12; month++) {
              const daysInMonth = getDaysInMonth(month, year);
  
              // Initialiser un tableau pour stocker les jours du mois
              const monthData = {};
  
              // Parcourir chaque jour du mois et initialiser les compteurs
              daysInMonth.forEach(day => {
                  const dayKey = day.getDate(); // Utiliser le jour du mois comme clé
                  const isUpcoming = day > today;
                  monthData[dayKey] = {
                      date: day.toISOString().split('T')[0], // Garder la date complète pour référence
                      totalPresent: 0,
                      isUpcoming
                  };
              });
  
              // Ajouter les données du mois à l'objet principal
              results[month] = monthData;
          }
  
          // Parcourir les données de présence et compter les présences par jour
          attendanceData.forEach(employee => {
              employee.attendanceData.forEach(record => {
                  if (record.dateConnected) {
                      const date = new Date(record.dateConnected);
                      const month = date.getMonth();
                      const day = date.getDate();
                      if (results[month] && results[month][day]) {
                          results[month][day].totalPresent++;
                      }
                  }
              });
          });
  
          // Calculer le pourcentage de présence pour chaque jour et reformater les résultats
          const resultsArray = Object.entries(results).map(([month, days]) => {
              return {
                  month: parseInt(month),
                  days: Object.entries(days).map(([day, data]) => ({
                      day: parseInt(day),
                      date: data.date,
                      attendancePercentage: totalEmployees > 0 ? (data.totalPresent * 100) / totalEmployees : 0,
                      isUpcoming: data.isUpcoming
                  }))
              };
          });
  
          res.json(resultsArray);
      } catch (error) {
          res.status(500).json({ message: 'Erreur serveur', error });
      }
  });
  
  


/*    {
        "month": "janvier",
        "year": 2024,
        "totalHoursDevelopers": 0,
        "totalHoursScrumMasters": 0
    },
    {
        "month": "février",
        "year": 2024,
        "totalHoursDevelopers": 0,
        "totalHoursScrumMasters": 0
    },*/

router.get('/monthly-connected-hours', async (req, res) => {
  try {
    // Obtenir les données de présence de tous les développeurs et Scrum Masters
    const developers = await Developer.find({}, 'attendanceData');
    const scrumMasters = await ScrumMaster.find({}, 'attendanceData');

    // Fonction pour obtenir le nom du mois
    const getMonthName = (monthNumber) => {
      const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
      return months[monthNumber - 1];
    };

    // Fonction pour obtenir le mois et l'année actuels
    const getCurrentMonthAndYear = () => {
      const now = new Date();
      const month = now.getMonth() + 1; // Ajouter 1 car les mois commencent à 0
      const year = now.getFullYear();
      return { month, year };
    };

    // Obtenir le mois et l'année actuels
    const { month: currentMonth, year: currentYear } = getCurrentMonthAndYear();

    // Initialiser un tableau pour stocker les résultats par mois
    let monthlyResults = [];

    // Parcourir tous les mois de l'année actuelle
    for (let month = 1; month <= 12; month++) {
      const monthName = getMonthName(month);
      let totalHoursDevelopers = 0;
      let totalHoursScrumMasters = 0;

      // Parcourir les données de présence et totaliser les heures connectées pour les développeurs
      developers.forEach(developer => {
        developer.attendanceData.forEach(record => {
          if (record.dateConnected) {
            const recordMonth = record.dateConnected.getMonth() + 1; // Ajouter 1 car les mois commencent à 0
            const recordYear = record.dateConnected.getFullYear();
            if (recordMonth === month && recordYear === currentYear) {
              totalHoursDevelopers += record.hoursConnected;
            }
          }
        });
      });

      // Parcourir les données de présence et totaliser les heures connectées pour les Scrum Masters
      scrumMasters.forEach(master => {
        master.attendanceData.forEach(record => {
          if (record.dateConnected) {
            const recordMonth = record.dateConnected.getMonth() + 1; // Ajouter 1 car les mois commencent à 0
            const recordYear = record.dateConnected.getFullYear();
            if (recordMonth === month && recordYear === currentYear) {
              totalHoursScrumMasters += record.hoursConnected;
            }
          }
        });
      });

      // Ajouter les données du mois au tableau des résultats
      monthlyResults.push({
        month: monthName,
        year: currentYear,
        totalHoursDevelopers,
        totalHoursScrumMasters
      });
    }

    res.json(monthlyResults);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error });
  }
});


/*{
    "present": 5,
    "absent": 2,
    "late": 5,
    "halfDay": 3,
    "fullDay": 0
}*/// pour chaque jours 

router.get('/attendance-stats/:Poid', async (req, res) => {
  try {
    const { Poid } = req.params;

    // Récupérer tous les équipes dont le productOwner est égal à Poid
    const teams = await Team.find({ productOwner: Poid });

    // Initialiser les statistiques
    let present = 0;
    let absent = 0;
    let late = 0;
    let halfDay = 0;
    let fullDay = 0;

    // Fonction pour vérifier si un employé est en retard
    const isLate = (connectTime) => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const lateTime = new Date(yesterday);
      lateTime.setHours(9, 30, 0, 0); // 9:30 AM
      return connectTime > lateTime;
    };

    // Parcourir les équipes
    for (const team of teams) {
      // Récupérer les développeurs associés à l'équipe
      const developers = await Developer.find({ assignedTeams: team._id });
      // Récupérer les Scrum Masters associés à l'équipe
      const scrumMasters = await ScrumMaster.find({ assignedTeams: team._id });

      // Parcourir les développeurs
      for (const developer of developers) {
        const latestAttendance = developer.attendanceData[developer.attendanceData.length - 1];
        const today = new Date().setHours(0, 0, 0, 0);
        
        if (latestAttendance && latestAttendance.dateConnected.setHours(0, 0, 0, 0) === today) {
          present++;
          if (isLate(latestAttendance.dateConnected.getTime())) {
            late++;
          }
          if (latestAttendance.hoursConnected < 4) {
            halfDay++;
          }
          if (latestAttendance.hoursConnected >= 8) {
            fullDay++;
          }
        } else {
          absent++;
        }
      }

      // Parcourir les Scrum Masters
      for (const scrumMaster of scrumMasters) {
        const latestAttendance = scrumMaster.attendanceData[scrumMaster.attendanceData.length - 1];
        const today = new Date().setHours(0, 0, 0, 0);
        
        if (latestAttendance && latestAttendance.dateConnected.setHours(0, 0, 0, 0) === today) {
          present++;
          if (isLate(latestAttendance.dateConnected.getTime())) {
            late++;
          }
          if (latestAttendance.hoursConnected < 4) {
            halfDay++;
          }
          if (latestAttendance.hoursConnected >= 8) {
            fullDay++;
          }
        } else {
          absent++;
        }
      }
    }

    // Construire les statistiques
    const stats = {
      present,
      absent,
      late,
      halfDay,
      fullDay
    };

    // Envoyer les statistiques en réponse
    res.json(stats);
  } catch (error) {
    // En cas d'erreur, renvoyer un message d'erreur
    console.error('Erreur lors de la récupération des statistiques d\'assiduité pour les Développeurs et les Scrum Masters:', error.message);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques d\'assiduité pour les Développeurs et les Scrum Masters' });
  }
});





/*{
  "UI/UX Design": 57.14285714285714,
  "Website Design": 0,
  "App Development": 0,
  "Quality Assurance": 0,
  "Development": 0,
  "Backend Development": 0,
  "Software Testing": 0,
  "Marketing": 14.285714285714285,
  "SEO": 0,
  "Other": 0,
  "Scrum Master": 28.57142857142857
}*/

router.get('/type-stats', async (req, res) => {
  try {
    // Récupérer tous les développeurs et les scrum masters
    const developers = await Developer.find();
    const scrumMasters = await ScrumMaster.find();

    // Calculer le nombre total d'employés
    const totalEmployees = developers.length + scrumMasters.length;

    // Initialiser un objet pour stocker le nombre de chaque type de développeur
    const typeCounts = {
      "UI/UX Design": 0,
      "Website Design": 0,
      "App Development": 0,
      "Quality Assurance": 0,
      "Development": 0,
      "Backend Development": 0,
      "Software Testing": 0,
      "Marketing": 0,
      "SEO": 0,
      "Other": 0
    };

    // Compter le nombre de chaque type de développeur
    for (const developer of developers) {
      typeCounts[developer.type]++;
    }

    // Calculer le pourcentage de chaque type de développeur
    const typePercentages = {};
    for (const type in typeCounts) {
      const percentage = (typeCounts[type] / totalEmployees) * 100;
      typePercentages[type] = percentage;
    }

    // Calculer le pourcentage de Scrum Masters
    const scrumMasterPercentage = (scrumMasters.length / totalEmployees) * 100;

    // Ajouter le pourcentage de Scrum Masters à l'objet des pourcentages par type de développeur
    typePercentages["Scrum Master"] = scrumMasterPercentage;

    // Envoyer les pourcentages en réponse
    res.json(typePercentages);
  } catch (error) {
    // En cas d'erreur, renvoyer un message d'erreur
    console.error('Erreur lors de la récupération des statistiques des types pour les Développeurs et les Scrum Masters:', error.message);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques des types pour les Développeurs et les Scrum Masters' });
  }
});

/*{
    "Test et validation ": [
        {
            "nom": "ra",
            "prenom": "ra",
            "hoursConnected": 7.786665833333333,
            "totalProjectHours": 352,
            "avgHoursConnectedForProject": 176,
            "score": "2.212"
        }
    ],
    "aaaaaaaaa": [
        {
            "nom": "rr",
            "prenom": "rr",
            "hoursConnected": 53.64992833333334,
            "totalProjectHours": 560,
            "avgHoursConnectedForProject": 280,
            "score": "9.580"
        }
    ]
}*/
router.get('/developers-score/:emailPo', async (req, res) => {
  const { emailPo } = req.params;

  try {
    // Récupérer les projets associés au Product Owner spécifié
    const projects = await Project.find({ emailPo }).populate('projectAssignedTeams');

    // Objet pour stocker les scores des développeurs regroupés par projet
    const projectDeveloperScores = {};

    // Parcourir chaque projet pour calculer les scores des développeurs
    for (const project of projects) {
      // Initialiser l'objet pour stocker les scores des développeurs pour ce projet
      if (!projectDeveloperScores[project.projectName]) {
        projectDeveloperScores[project.projectName] = [];
      }

      // Récupérer les développeurs assignés au projet
      const developers = await Developer.find({ assignedProjects: project._id });

      // Calcul du score pour chaque développeur
      for (const developer of developers) {
        let totalHoursConnected = 0;
        let totalProjectHours = 0;

        // Calcul du total des heures connectées et du nombre total d'heures de projet pour ce projet
        const projectStartDate = new Date(project.projectStartDate);
        const projectEndDate = new Date(project.projectEndDate);
        const totalProjectTime = Math.abs(projectEndDate - projectStartDate);
        const totalProjectDays = Math.ceil(totalProjectTime / (1000 * 60 * 60 * 24));
        const totalProjectHoursForThisProject = totalProjectDays * 8; // 8 heures de travail par jour
        totalProjectHours += totalProjectHoursForThisProject;

        // Filtrage des données de présence pour ce projet
        const attendanceDataForProject = developer.attendanceData.filter(data => {
          const currentDate = new Date(data.date);
          return currentDate >= projectStartDate && currentDate <= projectEndDate;
        });

        // Calcul du total des heures connectées pour ce projet
        for (const data of attendanceDataForProject) {
          totalHoursConnected += data.hoursConnected;
        }
        const avgHoursConnectedForProject =totalProjectHours / 2;
        // Calcul du score du développeur
        const score = (totalHoursConnected / totalProjectHours) * 100;
        const roundedScore = score.toFixed(3); // Arrondi à trois décimales

        projectDeveloperScores[project.projectName].push({
          nom: developer.nom,
          prenom: developer.prenom,
          hoursConnected: totalHoursConnected,
          totalProjectHours: totalProjectHours,
          avgHoursConnectedForProject:avgHoursConnectedForProject,
          score: roundedScore
        });
      }
    }

    res.status(200).json(projectDeveloperScores);
  } catch (error) {
    console.error('Erreur lors du calcul des scores des développeurs :', error);
    res.status(500).json({ message: 'Une erreur est survenue lors du calcul des scores des développeurs' });
  }
});


/*{
    "Test1": {
        "Po": 1,
        "Scrum": 1,
        "UI/UX Design": 1,
        "Total": 3
    },
    "Test2": {
        "Po": 1,
        "Scrum": 1,
        "Marketing": 1,
        "Total": 3
    }
}*/

router.get('/team-members-count/:emailPo', async (req, res) => {
  try {
    const { emailPo } = req.params;

    // Récupérer le Product Owner correspondant à l'email spécifié
    const productOwner = await ProductOwner.findOne({ email: emailPo });
    if (!productOwner) {
      return res.status(404).json({ message: 'Product Owner non trouvé' });
    }

    // Récupérer les équipes associées au Product Owner spécifié
    const teams = await Team.find({ productOwner: productOwner._id }).populate('developer scrumMaster productOwner');

    // Initialiser un objet pour stocker les comptages par équipe et par rôle
    const teamMembersCount = {};

    // Parcourir toutes les équipes
    teams.forEach(team => {
      const poCount = team.productOwner ? 1 : 0;
      const scrumMasterCount = team.scrumMaster ? 1 : 0;

      // Initialiser un objet pour stocker les comptages par type de membre
      const memberTypesCount = {
        Po: poCount,
        Scrum: scrumMasterCount
      };

      // Compter les membres de chaque type
      team.developer.forEach(dev => {
        const role = dev.type; // Assurez-vous que le modèle Developer a un champ "type" indiquant le rôle
        memberTypesCount[role] = (memberTypesCount[role] || 0) + 1;
      });

      // Calculer le nombre total de membres dans l'équipe
      const totalMembers = Object.values(memberTypesCount).reduce((total, count) => total + count, 0);

      // Ajouter les comptages par équipe à l'objet principal
      teamMembersCount[team.name] = {
        ...memberTypesCount,
        Total: totalMembers
      };
    });

    res.json(teamMembersCount);
  } catch (error) {
    console.error('Erreur lors de la récupération des comptages des membres par équipe :', error);
    res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des comptages des membres par équipe' });
  }
});
/*
[
    {
        "email": "ra@Vermeg.com",
        "score": 52.40042982711733
    },
    {
        "email": "rr@Vermeg.com",
        "score": 30.935310012210014
    }
]*/  //6premier dev score heure+score ticket/2 
router.get('/top-developers/:emailPo', async (req, res) => {
  const { emailPo } = req.params;

  try {
    // Récupérer les projets associés au Product Owner spécifié
    const projects = await Project.find({ emailPo }).populate('sprints.tickets');

    // Initialiser le compteur de tickets
    let totalTickets = 0;
    let completedTickets = 0;

    // Calculer le score pour chaque développeur basé sur les tâches complétées
    const developerScores = {};

    projects.forEach(project => {
      project.sprints.forEach(sprint => {
        sprint.tickets.forEach(ticket => {
          totalTickets++; // Incrémenter le nombre total de tickets
          if (ticket.ticketState === 'Completed') {
            completedTickets++; // Incrémenter le nombre de tickets complétés
          }
          const developerEmail = ticket.emailDeveloppeur;
          if (!developerScores[developerEmail]) {
            developerScores[developerEmail] = { totalTasks: 0, completedTasks: 0 };
          }
          developerScores[developerEmail].totalTasks++;
          if (ticket.ticketState === 'Completed') {
            developerScores[developerEmail].completedTasks++;
          }
        });
      });
    });

    // Calculer le score pour chaque développeur basé sur les heures de travail
    const developers = await Developer.find();
    const developersScores = {};

    for (const developer of developers) {
      let totalHoursConnected = 0;
      let totalProjectHours = 0;

      // Si le développeur n'a pas de projet assigné, son score est 0
      if (!developer.assignedProjects || developer.assignedProjects.length === 0) {
        developersScores[developer.email] = 0;
        continue;
      }

      // Calcul du total des heures connectées et du nombre total d'heures de projet pour chaque projet assigné
      for (const projectId of developer.assignedProjects) {
        const project = await Project.findById(projectId);
        if (project && project.emailPo === emailPo) {
          // Calcul du nombre total d'heures de projet
          const projectStartDate = new Date(project.projectStartDate);
          const projectEndDate = new Date(project.projectEndDate);
          const totalProjectTime = Math.abs(projectEndDate - projectStartDate);
          const totalProjectDays = Math.ceil(totalProjectTime / (1000 * 60 * 60 * 24));
          const totalProjectHoursForThisProject = totalProjectDays * 6.5; // 8 heures de travail par jour
          totalProjectHours += totalProjectHoursForThisProject;

          // Filtrage des données de présence pour ce projet
          const attendanceDataForProject = developer.attendanceData.filter(data => {
            const currentDate = new Date(data.date);
            return currentDate >= projectStartDate && currentDate <= projectEndDate;
          });

          // Calcul du total des heures connectées pour ce projet
          for (const data of attendanceDataForProject) {
            totalHoursConnected += data.hoursConnected;
          }
        }
      }

      // Calcul du score du développeur basé sur les heures de travail
      const scoreBasedOnHours = (totalHoursConnected / totalProjectHours) * 100;
      developersScores[developer.email] = scoreBasedOnHours;
    }

    // Fusionner les scores basés sur les tâches complétées et les heures de travail
    const combinedScores = {};

    Object.keys(developerScores).forEach(email => {
      const scoreBasedOnTasks = (developerScores[email].completedTasks / developerScores[email].totalTasks) * 100;
      const combinedScore = (scoreBasedOnTasks + developersScores[email]) / 2;
      combinedScores[email] = combinedScore;
    });

    // Trier les développeurs par score combiné
    const sortedDevelopers = Object.keys(combinedScores)
      .map(email => ({ email, score: combinedScores[email] }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    // Récupérer les types de chaque développeur
    const developersWithType = await Promise.all(sortedDevelopers.map(async developer => {
      const dev = await Developer.findOne({ email: developer.email });
      return {
        email: developer.email,
        score: developer.score,
        type: dev.type, // Ajout du type de développeur
      };
    }));

    // Ajout des données totalTickets et completedTickets à un objet unique
    const response = {
      TopDev: developersWithType,
      totalTickets,
      completedTickets
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Erreur lors de la récupération des meilleurs développeurs :', error);
    res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des meilleurs développeurs' });
  }
});


router.get('/get-monthday-members/:poid', async (req, res) => {
  try {
    const poid = req.params.poid;
    const productOwner = await ProductOwner.findById(poid);

    if (!productOwner) {
      return res.status(404).json({ message: 'Product Owner non trouvé' });
    }

    const teams = await Team.find({ productOwner: poid }).populate('developer scrumMaster');

    const membersAttendance = [];

    for (const team of teams) {
      // Récupérer les développeurs et ScrumMasters
      const developers = team.developer;
      const scrumMaster = team.scrumMaster;

      // Fonction pour récupérer l'assiduité pour un membre (dev ou scrumMaster)
      const getAttendance = async (member, role) => {
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

        const attendanceRecords = await member.attendanceData.filter(record => {
          const recordDate = new Date(record.date);
          return recordDate >= monthStart && recordDate <= monthEnd;
        });

        const attendanceArray = [];
        const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();

        for (let day = 1; day <= daysInMonth; day++) {
          const dayRecord = attendanceRecords.find(record => new Date(record.date).getDate() === day);
          if (dayRecord) {
            let attendanceStatus = 'Absent';
            if (dayRecord.hoursConnected >= 8) {
              attendanceStatus = 'Present';
            } else if (dayRecord.hoursConnected <= 4) {
              attendanceStatus = 'Half Present';
            }
            attendanceArray.push({ day: day, status: attendanceStatus });
          } else {
            attendanceArray.push({ day: day, status: 'Absent' });
          }
        }

        return {
          email: member.email,
          role,
          attendanceMonth: attendanceArray
        };
      };

      // Récupérer l'assiduité pour chaque développeur
      for (const developer of developers) {
        const devData = await Developer.findById(developer);
        if (devData) {
          const attendance = await getAttendance(devData, 'Developer');
          membersAttendance.push(attendance);
        }
      }

      // Récupérer l'assiduité pour le ScrumMaster
      if (scrumMaster) {
        const smData = await ScrumMaster.findById(scrumMaster);
        if (smData) {
          const attendance = await getAttendance(smData, 'ScrumMaster');
          membersAttendance.push(attendance);
        }
      }
    }

    res.status(200).json(membersAttendance);
  } catch (error) {
    console.error('Erreur lors de la récupération des données d\'assiduité des membres :', error);
    res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des données d\'assiduité des membres' });
  }
});

/*{
  "Test et validation ": {
      "scrumMasterEmail": "r@Vermeg.com",
      "dailyScrums": [
          {
              "dailyUrl": "https://meet.google.com/exg-foxs-tip?pli=1",
              "dailyProgram": "2024-06-01T10:47:00.000Z",
              "status": "Completed"
          }
      ]
  }
}*/

router.get('/daily-scrums/:emailPo', async (req, res) => {
  const { emailPo } = req.params; // Récupère le paramètre emailPo de la requête

  try {
    // Construire le filtre de requête en fonction de l'emailPo
    const queryFilter = emailPo ? { emailPo } : {};

    const projects = await Project.find(queryFilter)
      .populate({
        path: 'projectAssignedTeams',
        populate: {
          path: 'scrumMaster',
          select: 'email'
        }
      });

    const dailyScrumData = {};

    projects.forEach(project => {
      const projectId = project._id; // Utiliser l'ID unique du projet comme clé
      const projectName = project.projectName;
      const scrumMasterEmail = project.projectAssignedTeams?.scrumMaster?.email || 'No Scrum Master';

      if (!dailyScrumData[projectId]) {
        dailyScrumData[projectId] = {
          projectName,
          scrumMasterEmail,
          dailyScrums: []
        };
      }

      project.dailyScrums.forEach(scrum => {
        const status = scrum.annuler ? 'Annuler' : scrum.added ? 'Completed' : 'Upcoming';

        dailyScrumData[projectId].dailyScrums.push({
          dailyUrl: scrum.dailyUrl,
          dailyProgram: scrum.dailyProgram,
          status
        });
      });
    });

    res.status(200).json(dailyScrumData);
  } catch (error) {
    console.error('Erreur lors de la récupération des réunions quotidiennes:', error);
    res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des réunions quotidiennes' });
  }
});



const generateDatesOfYear = () => {
  const dates = [];
  const currentDate = new Date();
  const startOfYear = new Date(currentDate.getFullYear(), 0, 1);
  
  while (startOfYear <= currentDate) {
    dates.push(new Date(startOfYear));
    startOfYear.setDate(startOfYear.getDate() + 1);
  }
  
  return dates;
};



/*  {
    "attendance": [
        {
            "date": "2023-12-31",
            "développeurs": 0,
            "scrumMasters": 0
        },
        {
            "date": "2024-01-01",
            "développeurs": 0,
            "scrumMasters": 0
        },  ],
    "totalEmployees": 7
}*/  // attendance de chaque jour de debut lannes ver notre jorus la 


router.get('/monthly-attendance/:poid', async (req, res) => {
  try {
    const teams = await Team.find({ productOwner: req.params.poid, projects: { $exists: true, $ne: [] } })
                            .populate('developer scrumMaster');

    const developerIds = teams.flatMap(team => team.developer.map(dev => dev._id));
    const scrumMasterIds = teams.map(team => team.scrumMaster?._id).filter(id => id); // Si scrumMaster est un champ unique

    const today = new Date();
    const year = today.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31);

    // Fonction pour obtenir les présences d'un rôle
    const getAttendanceData = async (Model, role, ids) => {
      const attendanceData = await Model.aggregate([
        { $match: { _id: { $in: ids } } },
        { $unwind: "$attendanceData" },
        { $match: { "attendanceData.date": { $gte: startOfYear, $lte: endOfYear } } },
        {
          $group: {
            _id: { month: { $month: "$attendanceData.date" } },
            count: { $sum: "$attendanceData.hoursConnected" }
          }
        },
        {
          $project: {
            _id: 0,
            month: "$_id.month",
            count: 1,
            role: { $literal: role }
          }
        }
      ]);
      return attendanceData;
    };

    // Obtenez les données d'assiduité des développeurs et des scrum masters liés aux équipes
    const developerAttendance = await getAttendanceData(Developer, 'Développeur', developerIds);
    const scrumMasterAttendance = await getAttendanceData(ScrumMaster, 'Scrum Master', scrumMasterIds);

    // Combinez les données d'assiduité
    const combinedAttendance = [...developerAttendance, ...scrumMasterAttendance];

    // Noms des mois en français
    const monthNames = [
      "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
      "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
    ];

    // Initialiser un tableau pour stocker les présences par mois
    const attendanceByMonth = Array.from({ length: 12 }, (_, index) => ({
      month: monthNames[index],
      développeurs: 0,
      scrumMasters: 0
    }));

    // Agréger les présences par mois
    combinedAttendance.forEach(curr => {
      const monthIndex = curr.month - 1; // Le mois est entre 1 et 12, donc nous devons soustraire 1 pour obtenir l'index correct
      if (curr.role === 'Développeur') {
        attendanceByMonth[monthIndex].développeurs += curr.count;
      } else if (curr.role === 'Scrum Master') {
        attendanceByMonth[monthIndex].scrumMasters += curr.count;
      }
    });

    res.status(200).json({ attendance: attendanceByMonth });
  } catch (error) {
    console.error('Erreur lors de la récupération des données d\'assiduité mensuelle:', error);
    res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des données d\'assiduité mensuelle' });
  }
});


router.get('/details', async (req, res) => {
  try {
      const teamCount = await Team.countDocuments();
      const DevCount = await Developer.countDocuments();
      const ScmCount = await ScrumMaster.countDocuments();
      const projectCount = await Project.countDocuments();
      employeeCount=DevCount+ ScmCount 
      res.json({ teamCount, employeeCount, projectCount });
  } catch (error) {
      res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des détails.' });
  }
});



router.get('/getWorking-progress/:PoId', async (req, res) => {
  const PoId = req.params.PoId;

  try {
    // Trouver les équipes liées au Product Owner (PoId)
    const teams = await Team.find({ productOwner: PoId });

    // Récupérer les développeurs et Scrum Masters de chaque équipe
    const teamIds = teams.map(team => team._id);
    const developers = await Developer.find({ assignedTeams: { $in: teamIds } });
    const scrumMasters = await ScrumMaster.find({ assignedTeams: { $in: teamIds } });

    // Obtenir l'année actuelle
    const currentYear = new Date().getFullYear();

    // Initialiser un objet pour stocker les heures de travail et le progrès pour chaque mois
    const monthlyData = {};

    // Noms des mois en français
    const monthNames = [
      "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
      "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
    ];

    // Parcourir chaque mois de l'année actuelle
    for (let month = 0; month < 12; month++) {
      // Initialiser les heures de travail et le progrès pour ce mois
      let totalDeveloperHours = 0;
      let totalScrumMasterHours = 0;
      let totalProgress = 0;

      // Calculer les heures de travail totales pour les développeurs
      for (const dev of developers) {
        for (const attendance of dev.attendanceData) {
          const attendanceDate = new Date(attendance.date);
          if (attendanceDate.getMonth() === month && attendanceDate.getFullYear() === currentYear) {
            totalDeveloperHours += attendance.hoursConnected;
          }
        }
      }

      // Calculer les heures de travail totales pour les Scrum Masters
      for (const scm of scrumMasters) {
        for (const attendance of scm.attendanceData) {
          const attendanceDate = new Date(attendance.date);
          if (attendanceDate.getMonth() === month && attendanceDate.getFullYear() === currentYear) {
            totalScrumMasterHours += attendance.hoursConnected;
          }
        }
      }

      // Calculer le nombre total d'employés (développeurs et Scrum Masters)
      const totalEmployees = developers.length + scrumMasters.length;

      // Calculer le progrès total pour ce mois
      const totalProgressPercentage = ((totalDeveloperHours + totalScrumMasterHours) / (26 * totalEmployees * 6)) * 100;
      const totalworkHours = totalDeveloperHours + totalScrumMasterHours;

      // Récupérer le nom du mois
      const monthName = monthNames[month];

      // Stocker les données mensuelles dans l'objet monthlyData
      monthlyData[monthName] = {
        totalworkHours,
        totalProgress: totalProgressPercentage
      };
    }

    // Retourner les données mensuelles
    res.json({ monthlyData });
  } catch (error) {
    console.error('Erreur lors de la récupération des données de travail et de progrès:', error);
    res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des données de travail et de progrès' });
  }
});


router.get('/get-WorkingToday/:PoId', async (req, res) => {
  const PoId = req.params.PoId;

  try {
    // Retrieve all teams for the given Product Owner
    const teams = await Team.find({ productOwner: PoId });

    let developerIds = [];
    let scrumMasterIds = [];

    // Extract developer and scrum master IDs from teams
    teams.forEach(team => {
      developerIds = developerIds.concat(team.developer);
      scrumMasterIds  = scrumMasterIds.concat(team.scrumMaster);
    });

    // Retrieve developer and scrum master documents using their IDs
    const developers = await Developer.find({ _id: { $in: developerIds } });
    const scrumMasters = await ScrumMaster.find({ _id: { $in: scrumMasterIds } });

    let totalHoursConnected = 0;
    let numberOfDevelopers = developers.length;
    let numberOfScrumMasters = scrumMasters.length;

    const today = new Date().setHours(0, 0, 0, 0);

    // Calculate total hours connected today for developers
    developers.forEach(dev => {
      const attendanceToday = dev.attendanceData.find(att => new Date(att.date).setHours(0, 0, 0, 0) === today);
      if (attendanceToday) {
       
        totalHoursConnected += attendanceToday.hoursConnected;
      } else {
      
      }
    });

    // Calculate total hours connected today for Scrum Masters
    scrumMasters.forEach(scrumMaster => {
      const attendanceToday = scrumMaster.attendanceData.find(att => new Date(att.date).setHours(0, 0, 0, 0) === today);
      if (attendanceToday) {
     
        totalHoursConnected += attendanceToday.hoursConnected;
      } else {
   
      }
    });

    const maximumPercentage = 100;
     
    const denominator = 6 * (numberOfDevelopers + numberOfScrumMasters);
    
    let workingPercentage;
    if (denominator === 0) {
      workingPercentage = 0;
    } else {
      workingPercentage = (totalHoursConnected * 100) / denominator;
      // Limiter le pourcentage de travail à un maximum de 100
      workingPercentage = Math.min(workingPercentage, maximumPercentage);
    }
    
   

    res.json({ workingPercentage });
  } catch (error) {
    console.error('Error fetching working percentage:', error);
    res.status(500).send('Internal Server Error');
  }
});




////// projetc dashborad 
// Route pour récupérer les détails des tickets d'un projet spécifique
router.get('/product-projects/:projectId', async (req, res) => {
  try {
    // Récupérer les détails du projet en utilisant l'ID du projet
    const project = await Project.findById(req.params.projectId);
    // Calculer le nombre de tickets dans chaque état pour chaque sprint
    const projectData = project.sprints.map(sprint => {
      const tickets = sprint.tickets;
      const ticketStats = {
        sprintName: sprint.sprintName,
        todoCount: tickets.filter(ticket => ticket.ticketState === 'To Do').length,
        inProgressCount: tickets.filter(ticket => ticket.ticketState === 'In Progress').length,
        completedCount: tickets.filter(ticket => ticket.ticketState === 'Completed').length
      };
      return ticketStats;
    });
    res.json(projectData);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Route pour récupérer le nombre de tickets créés aujourd'hui pour chaque projet associé à un utilisateur
router.get('/tickets-per-today/:emailPo', async (req, res) => {
  try {
    const { emailPo } = req.params;

    // Récupérer tous les projets associés à l'utilisateur
    const projects = await Project.find({ emailPo });

    // Initialiser un objet pour stocker le nombre de tickets créés aujourd'hui pour chaque projet
    const ticketsPerProjectToday = {};

    // Parcourir tous les projets associés à l'utilisateur
    for (const project of projects) {
      let ticketsCountToday = 0;

      // Parcourir tous les sprints du projet
      project.sprints.forEach(sprint => {
        // Parcourir tous les tickets de chaque sprint
        sprint.tickets.forEach(ticket => {
          // Obtenir la date de création du ticket
          const creationDate = new Date(ticket.dateCreation).toISOString().slice(0, 10);
          // Vérifier si la date de création est aujourd'hui
          const today = new Date().toISOString().slice(0, 10);
          if (creationDate === today) {
            ticketsCountToday++;
          }
        });
      });

      // Stocker le nombre de tickets créés aujourd'hui pour ce projet
      ticketsPerProjectToday[project.projectName] = ticketsCountToday;
    }

    res.json(ticketsPerProjectToday);
  } catch (error) {
    console.error('Erreur lors de la récupération des tickets créés aujourd\'hui :', error);
    res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des tickets créés aujourd\'hui' });
  }
});

router.get('/project-timeline/:emailPo', async (req, res) => {
  try {
    const { emailPo } = req.params;
    // Recherche des projets appartenant à l'utilisateur spécifié par emailPo
    const projects = await Project.find({ emailPo });

    // Construction de la chronologie des projets
    const projectTimeline = projects.map(project => ({
      projectName: project.projectName,
      startDate: project.projectStartDate,
      endDate: project.projectEndDate
    }));

    res.json(projectTimeline);
  } catch (error) {
    console.error('Error fetching project timeline:', error);
    res.status(500).json({ message: 'An error occurred while fetching project timeline' });
  }
});

router.get('/categories/:emailPo', async (req, res) => {
  try {
    const emailPo = req.params.emailPo;
    const projects = await Project.aggregate([
      { $match: { emailPo: emailPo } },
      {
        $group: {
          _id: '$projectCategory',
          count: { $sum: 1 },
        },
      },
    ]);

    const totalProjects = projects.reduce((total, project) => total + project.count, 0);

    const projectsWithPercentage = projects.map(project => ({
      category: project._id,
      count: project.count,
      percentage: (project.count / totalProjects) * 100,
    }));

    res.json(projectsWithPercentage);
  } catch (error) {
    console.error('Error fetching project data:', error);
    res.status(500).json({ message: 'An error occurred while fetching project data' });
  }
});

router.get('/Project-Details/:emailPo', async (req, res) => {
  try {
    const { emailPo } = req.params;
    if (!emailPo) {
      return res.status(400).json({ message: "L'e-mail du Product Owner est requis dans le corps de la requête" });
    }

    const projects = await Project.find({ emailPo });

    // Total des tâches par statut
    let totalTasks = 0;
    let completedTasks = 0;
    let inProgressTasks = 0;
    let toDoTasks = 0;

    // Total des projets
    let totalProjects = projects.length;

    // Projets à venir
    let comingProjects = 0;

    // Projets en cours
    let progressProjects = 0;

    // Fichiers finis
    let finishedFiles = 0;

    projects.forEach(project => {
      // Calcul du nombre total de tâches
      totalTasks += project.sprints.reduce((acc, sprint) => acc + sprint.tickets.length, 0);

      // Calcul du nombre de tâches terminées, en cours et à faire
      project.sprints.forEach(sprint => {
        sprint.tickets.forEach(ticket => {
          if (ticket.ticketState === 'Completed') {
            completedTasks++;
          } else if (ticket.ticketState === 'In Progress') {
            inProgressTasks++;
          } else {
            toDoTasks++;
          }
        });
      });

      // Vérifier si le projet est à venir, en cours ou terminé
      const currentDate = new Date();
      if (currentDate < project.projectStartDate) {
        comingProjects++;
      } else if (currentDate >= project.projectStartDate && currentDate <= project.projectEndDate) {
        progressProjects++;
      } else {
        finishedFiles += project.userStories.length + project.productBacklog.length;
      }
    });

    res.status(200).json({
      totalTasks,
      completedTasks,
      inProgressTasks,
      toDoTasks,
      totalProjects,
      comingProjects,
      progressProjects,
      finishedFiles
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des détails des projets :', error);
    res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des détails des projets' });
  }
});
module.exports = router;

