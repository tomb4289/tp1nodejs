# TP1 - Mini-application Node.js avec API publique

## Page de garde

**ATTESTATION D'ÉTUDES COLLÉGIALES**  
**CONCEPTION ET PROGRAMMATION DE SITES WEB (NWE.0F)**  
Techniques avancées en programmation Web  
582-41F-MA  

**TP 1 - Création d'une mini-application Node.js API publique**  
**20 %**  

**Professeur:** Marcos Sanches  
**msanches@cmaisonneuve.qc.ca**  

**COLLÈGE DE MAISONNEUVE**  
2030, boul. Pie-IX, bureau 430  
Montréal (Québec) H1V 2C8  
Téléphone : 514 254-7131  

---

## Description du projet

Cette mini-application Node.js permet de rechercher et d'afficher des informations sur des films en utilisant l'API The Movie Database (TMDB). L'application permet de rechercher des films par titre, naviguer par catégories (populaires, mieux notés, au cinéma), et afficher les détails complets de chaque film. Les données sont sauvegardées localement en fichiers JSON.

### Structure du projet
```
tp1node/
├── index.js              # Serveur Express principal
├── config.js             # Configuration des variables d'environnement
├── package.json          # Dépendances et scripts
├── .env                  # Variables d'environnement (clé API)
├── data/                 # Dossier des données JSON (générées automatiquement)
│   ├── popular_movies.json   # Données des films populaires
│   ├── toprated_movies.json  # Données des films mieux notés
│   ├── nowplaying_movies.json # Données des films au cinéma
│   ├── search_*.json         # Données de recherche
│   └── movie_*.json          # Données de films individuels
├── public/               # Dossier des fichiers statiques
│   ├── index.html        # Page d'accueil
│   ├── view.html         # Page de détails
│   ├── styles.css        # Styles CSS
│   ├── script.js         # JavaScript de la page d'accueil
│   ├── view.js           # JavaScript de la page de détails
│   └── notifications.js  # Système de notifications
└── DOCUMENTATION.md      # Documentation du projet
```

---

## Installation des bibliothèques

### Commandes d'installation

```bash
npm install express dotenv request nodemon
```

### Dépendances installées
- **express** - Framework web pour Node.js
- **dotenv** - Gestion des variables d'environnement
- **request** - Client HTTP pour les requêtes API
- **nodemon** - Redémarrage automatique du serveur

---

## Instructions d'installation et d'exécution

### 1. Installer les dépendances
```bash
npm install
```

### 2. Configuration de l'environnement
Créer un fichier `.env` à la racine du projet :
```env
PORT=3000
API_KEY=dd73d5c48fcfafffeba77854d1035138
```

### 3. Démarrer le serveur
```bash
npm start
```

### 4. Accéder à l'application
Ouvrir un navigateur et aller à : `http://localhost:3000`

---

## Lien GitHub

**Repository GitHub:** [URL_DU_REPO_GITHUB]
