const Developer = require("../models/User");
const ScrumMaster = require("../models/SM");
const ProductOwner = require("../models/Po");

const handleSignIn = async (userId, role) => {
  try {
    let user;

    switch (role) {
      case 'Développeur':
        user = await Developer.findById(userId);
        break;
      case 'Scrum Master':
        user = await ScrumMaster.findById(userId);
        break;
      case 'Product Owner':
        user = await ProductOwner.findById(userId);
        break;
      default:
        throw new Error('Rôle utilisateur non valide');
    }

    if (!user) {
      throw new Error(`${role} introuvable`);
    }

    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Réglage de l'heure à minuit

    // Vérifier les entrées de présence sans dateDisconnected
    const lastUnclosedAttendance = user.attendanceData.find(attendance => attendance.dateDisconnected === null);

    if (lastUnclosedAttendance) {
      // Mettre à jour la date de déconnexion et les heures connectées
      lastUnclosedAttendance.dateDisconnected = now;
      lastUnclosedAttendance.hoursConnected = (lastUnclosedAttendance.dateDisconnected - lastUnclosedAttendance.dateConnected) / (1000 * 60 * 60);
      lastUnclosedAttendance.isConnected = false;
    }

    // Trouver ou initialiser l'entrée de présence pour aujourd'hui
    let attendanceToday = user.attendanceData.find(attendance => {
      const attendanceDate = new Date(attendance.date);
      attendanceDate.setHours(0, 0, 0, 0); // Réglage de l'heure à minuit
      return attendanceDate.getTime() === today.getTime();
    });

    if (!attendanceToday) {
      // Si aucune entrée n'existe pour aujourd'hui, créer une nouvelle entrée
      attendanceToday = {
        date: now,
        dateConnected: now, // Première connexion aujourd'hui
        dateDisconnected: null,
        hoursConnected: 0,
        isConnected: true
      };
      user.attendanceData.push(attendanceToday);
    } else {
      // Si une entrée existe déjà, mettre à jour la date de connexion et isConnected
      attendanceToday.isConnected = true;
    }

    await user.save();
  } catch (error) {
    console.error(`Erreur lors de la gestion de la connexion pour ${role} :`, error.message);
    throw new Error(`Erreur lors de la gestion de la connexion pour ${role}`);
  }
};

const handleSignOut = async (userId, role) => {
  try {
    let user;

    switch (role) {
      case 'Développeur':
        user = await Developer.findById(userId);
        break;
      case 'Scrum Master':
        user = await ScrumMaster.findById(userId);
        break;
      case 'Product Owner':
        user = await ProductOwner.findById(userId);
        break;
      default:
        throw new Error('Rôle utilisateur non valide');
    }

    if (!user) {
      throw new Error(`${role} introuvable`);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Réglage de l'heure à minuit

    const todayAttendanceIndex = user.attendanceData.findIndex(attendance => {
      const attendanceDate = new Date(attendance.date);
      attendanceDate.setHours(0, 0, 0, 0); // Réglage de l'heure à minuit
      return attendanceDate.getTime() === today.getTime();
    });

    if (todayAttendanceIndex !== -1) {
      user.attendanceData[todayAttendanceIndex].dateDisconnected = new Date();
      user.attendanceData[todayAttendanceIndex].hoursConnected = (user.attendanceData[todayAttendanceIndex].dateDisconnected - user.attendanceData[todayAttendanceIndex].dateConnected) / (1000 * 60 * 60);
      user.attendanceData[todayAttendanceIndex].isConnected = false;

      await user.save();
    } else {
      // Si aucune entrée de présence trouvée pour aujourd'hui, chercher l'entrée la plus récente
      const lastIndex = user.attendanceData.length - 1;
      if (lastIndex !== -1) {
        user.attendanceData[lastIndex].hoursConnected = (user.attendanceData[lastIndex].dateDisconnected - user.attendanceData[lastIndex].dateConnected) / (1000 * 60 * 60);
        user.attendanceData[lastIndex].isConnected = false;

        await user.save();
      } else {
        console.error(`Aucune entrée de présence trouvée pour ${role} avec une connexion active.`);
        throw new Error(`Aucune entrée de présence trouvée pour ${role} avec une connexion active`);
      }
    }
  } catch (error) {
    console.error(`Erreur lors de la gestion de la déconnexion pour ${role} :`, error.message);
    throw new Error(`Erreur lors de la gestion de la déconnexion pour ${role}`);
  }
};

module.exports = {
  handleSignIn,
  handleSignOut
};
