const mongoose = require('mongoose');

// Définition des codes Scrum Master autorisés
const allowedScrumMasterCodes = ['111111', '222222', '333333', '444444'];


const profileInfoSchema = new mongoose.Schema({
  photo: { type: String, default: '1.jpg' }, // Photo par défaut
  address: { type: String, default: 'Default Address' }, // Adresse par défaut
  birthday: { type: Date, default: Date.now }, // Date de naissance par défaut
  email: { type: String, default: 'default@example.com' }, // Email par défaut
  description: { type: String, default: 'No description provided' },
  nationality: { type: String, default: 'Nationality' },
  emergencyNumber: { type: String, default: 'Emergency Number' },
  gmail: { type: String, default: 'Gmail' },
  etat: { type: String, default: 'État' }
});
const dailyAttendanceSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  dateConnected: { type: Date, default: null },
  dateDisconnected: { type: Date, default: null },
  hoursConnected: { type: Number, default: 0 },
  isConnected: { type: Boolean, default: false }
});
const experienceSchema = new mongoose.Schema({
  title: { type: String, default: 'Default Title' },
  company: { type: String, default: 'Default Company' },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date, default: null },
  description: { type: String, default: 'Default Description' },
  
});
const ScrumMasterSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  prenom: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
 
  CodeScrumMaster: { 
    type: String, 
    required: true, 
    validate: {
      validator: function(code) {
        return allowedScrumMasterCodes.includes(code); // Vérifie si le code est présent dans allowedScrumMasterCodes
      },
      message: props => `${props.value} n'est pas un code Scrum Master valide`
    }
  },
  profileInfo: profileInfoSchema,
  experiences: [experienceSchema],
  assignedTeams: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }],
  attendanceData: [dailyAttendanceSchema],
  assignedProjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }] 
});

ScrumMasterSchema.pre('save', function(next) {
  // Vérifie si le profil est déjà rempli
  if (!this.profileInfo) {
    // Créer un nouveau profil s'il n'existe pas
    this.profileInfo = { 
      photo: 'avatar1713021102145.png', // Initialise photo à null
      address: 'Default Address',
      email: 'default@example.com',
      description: 'No description provided'
    };
  }
  
  // Vérifie si l'expérience est déjà remplie
  if (!this.experiences || this.experiences.length === 0) {
    // Crée une nouvelle expérience par défaut
    const defaultExperience = {
      title: 'Default title',
      company: 'Default company',
      startDate: new Date(),
      endDate: null,
      description: 'Default description'
    };
    
    // Ajoute l'expérience par défaut à la liste des expériences
    this.experiences = [defaultExperience];
  }
  
  next();
});

const ScrumMaster = mongoose.model('ScrumMaster', ScrumMasterSchema);

module.exports = ScrumMaster;
