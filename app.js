const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); // Importez le module CORS
const cron = require('node-cron'); // Importez le module node-cron
const Project = require('./models/Projet');
require('dotenv').config();

const app = express();

// Middleware pour parser le JSON
app.use(express.json());

// Middleware CORS pour autoriser les requêtes depuis le port 3001 (votre frontend)
app.use(cors({
  origin: 'http://localhost:3001' // Remplacez cela par l'URL de votre frontend en production
}));

mongoose.connect(process.env.DB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(async () => {
  console.log('Connected to MongoDB');

  // Appel de la méthode pour mettre à jour les Daily Scrums en retard
 // Assurez-vous que le chemin est correct
  await Project.updateDelayedDailyScrums();
  console.log('Initial update of delayed Daily Scrums complete');

})
.catch(err => console.error('Error connecting to MongoDB:', err));

// Définition des routes
const userRoutes = require('./routes/userRoutes');
app.use('/api/Devellopeurs', userRoutes);

const poRoutes = require('./routes/POroutes');
app.use('/api/ProductOwners', poRoutes);


 const Scrumroutes=require('./routes/Scrumroutes');
 app.use('/api/scrumMasters', Scrumroutes);

 const Holidays=require('./routes/holidays');
 app.use('/api/holidays', Holidays);

 const notif=require('./routes/notification');
 app.use('/api/notification',notif);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

