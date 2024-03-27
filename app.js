const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); // Importez le module CORS

require('dotenv').config();

const app = express();

// Middleware pour parser le JSON
app.use(express.json());

// Middleware CORS pour autoriser les requêtes depuis le port 3001 (votre frontend)
app.use(cors({
  origin: 'http://localhost:3001' // Remplacez cela par l'URL de votre frontend en production
}));

// Connexion à la base de données
mongoose.connect(process.env.DB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('Error connecting to MongoDB:', err));

// Définition des routes
const userRoutes = require('./routes/userRoutes');
app.use('/api/Devellopeurs', userRoutes);

const poRoutes = require('./routes/POroutes');
app.use('/api/ProductOwners', poRoutes);


 const Scrumroutes=require('./routes/Scrumroutes');
 app.use('/api/scrumMasters', Scrumroutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
