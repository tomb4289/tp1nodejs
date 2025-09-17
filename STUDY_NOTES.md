# TP1 - Study Notes for Live Presentation
## Everything We Implemented Today

---

## 🎯 PROJECT OVERVIEW

**What we built:** A Node.js + Express movie application using TMDB API
**Why TMDB:** It's a public API that allows parameterized requests (GET /movie/{id}) and provides both general info and detailed data
**Teacher's style:** We followed the FinanceRest project structure (no comments, same patterns)

---

## 📋 TP1 REQUIREMENTS CHECKLIST

### ✅ REQUIRED FEATURES (All Implemented)

1. **Node.js + Express Server** ✅
   - `index.js` with Express setup
   - Static file serving for public folder
   - Port configuration via .env

2. **Two Required Routes** ✅
   - `/fetch=:id` - Fetches movie data and saves to JSON
   - `/data/:id` - Returns JSON data for frontend

3. **Public API Integration** ✅
   - TMDB API with API key in .env
   - Parameterized requests (movie ID, search query, categories)

4. **JSON File Saving** ✅
   - Individual movies: `movie_{id}.json`
   - Categories: `popular_movies.json`, `toprated_movies.json`, etc.
   - Search results: `search_{query}.json`

5. **.env File** ✅
   - API_KEY stored securely
   - PORT configuration
   - Loaded via config.js (following teacher's pattern)

6. **Dynamic HTML Interface** ✅
   - `index.html` - Homepage with search and categories
   - `view.html` - Details page with movie grid
   - JavaScript for dynamic content loading

7. **CSS Styling** ✅
   - Modern design inspired by DreadScale
   - Responsive layout
   - Glass-morphism effects

---

## 🔧 TECHNICAL IMPLEMENTATION DETAILS

### 1. SERVER SETUP (index.js)

**Why this structure:**
```javascript
const express = require('express')
const app = express();
const config = require('./config.js')
const request = require('request')
const fs = require('fs')
const path = require('path')
```

**Explanation:**
- Following teacher's FinanceRest pattern exactly
- `config.js` for environment variables (like teacher's project)
- `request` library (same as teacher, not axios)
- `fs` for file operations
- `path` for file path handling

### 2. ROUTE IMPLEMENTATION

**Required Route 1: `/fetch=:id`**
```javascript
app.get('/fetch=:id', (req, res) => {
    const movieId = req.params.id
    var url = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${config.API_KEY}&language=fr-FR`;
    
    request.get({url, json:true}, (err, response, data) => {
        if(err || response.statusCode != 200) {
            return res.status(500).send('Error fetching data')
        }
        fs.writeFile(`movie_${movieId}.json`, JSON.stringify(data), () => {
            res.redirect(`/view?id=${movieId}`)
        })
    })
})
```

**Why this approach:**
- Exact same pattern as teacher's `/ticker=:id` route
- Uses `request` library (not axios like DreadScale)
- Saves to JSON file with descriptive name
- Redirects to view page after saving
- Error handling for API failures

**Required Route 2: `/data/:id`**
```javascript
app.get('/data/:id', (req, res) => {
    const movieId = req.params.id
    const filePath = `movie_${movieId}.json`
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Movie data not found' })
    }
    
    const movieData = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    res.json(movieData)
})
```

**Why this approach:**
- Reads the saved JSON file
- Checks if file exists before reading
- Returns JSON data for frontend consumption
- Error handling for missing files

### 3. BONUS ROUTES (Why We Added Them)

**Category Routes:**
```javascript
app.get('/fetch=popular', (req, res) => {
    var url = `https://api.themoviedb.org/3/movie/popular?api_key=${config.API_KEY}&language=fr-FR`;
    // ... saves to popular_movies.json and redirects to /view?type=popular
})
```

**Why we added these:**
- TMDB API provides category endpoints
- Gives users more ways to discover movies
- Demonstrates understanding of different API endpoints
- Follows same pattern as main route

**Search Route:**
```javascript
app.get('/search=:query', (req, res) => {
    const query = req.params.query
    var url = `https://api.themoviedb.org/3/search/movie?api_key=${config.API_KEY}&language=fr-FR&query=${encodeURIComponent(query)}`;
    // ... saves to search_{query}.json
})
```

**Why we added this:**
- More user-friendly than ID-based search
- TMDB has excellent search functionality
- URL encoding for special characters
- Same save-and-redirect pattern

### 4. ROUTE ORDER FIX (Critical Issue We Solved)

**Problem we encountered:**
```javascript
// WRONG ORDER - This caused issues
app.get('/fetch=:id', (req, res) => { ... })      // This caught /fetch=popular
app.get('/fetch=popular', (req, res) => { ... })  // This never got reached
```

**Solution:**
```javascript
// CORRECT ORDER - Specific routes first
app.get('/fetch=popular', (req, res) => { ... })
app.get('/fetch=toprated', (req, res) => { ... })
app.get('/fetch=nowplaying', (req, res) => { ... })
app.get('/fetch=:id', (req, res) => { ... })      // Generic route last
```

**Why this matters:**
- Express matches routes in order
- Generic `:id` parameter catches everything
- Specific routes must come before generic ones

---

## 🎨 FRONTEND IMPLEMENTATION

### 1. HOMEPAGE (index.html)

**Original Design:**
- Simple form with movie ID input
- Basic Bootstrap styling

**DreadScale Integration:**
- Replaced Bootstrap with custom CSS
- Added glass-morphism effects
- Implemented category buttons
- Added notification system
- Modern hero section design

**Why we changed it:**
- DreadScale had beautiful, modern design
- Glass-morphism is trendy and professional
- Category buttons improve user experience
- Notifications provide better feedback

### 2. SEARCH FUNCTIONALITY

**Original:** ID-based search (like teacher's ticker example)
**New:** Title-based search

**Why we changed:**
- More user-friendly (users know movie titles, not IDs)
- TMDB search API is excellent
- Better user experience
- Still maintains same technical pattern

**Implementation:**
```javascript
// Frontend sends search query
window.location.href = `/search=${encodeURIComponent(movieQuery)}`;

// Backend processes search
app.get('/search=:query', (req, res) => {
    // ... API call to TMDB search endpoint
    // ... save results to JSON
    // ... redirect to view page
})
```

### 3. MOVIE GRID DISPLAY

**Why we added this:**
- Categories return multiple movies
- Search returns multiple results
- Grid layout is better for multiple items
- Inspired by DreadScale's movie grid

**Implementation:**
```javascript
function displayMoviesGrid(movies, type, query = '') {
    // Create movie cards for each movie
    const movieCards = movies.map(movie => createMovieCard(movie)).join('');
    moviesGrid.innerHTML = movieCards;
    moviesGrid.style.display = 'grid';
}
```

### 4. ERROR HANDLING

**Why this is important:**
- API calls can fail
- Files might not exist
- User input might be invalid
- Professional applications handle errors gracefully

**Examples:**
```javascript
// API error handling
if(err || response.statusCode != 200) {
    return res.status(500).send('Error fetching data')
}

// File existence check
if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Movie data not found' })
}

// Frontend error display
function showError(message) {
    // Display user-friendly error message
}
```

---

## 🎨 DREADSCALE INTEGRATION

### Why We Used DreadScale Elements

1. **Beautiful Design System**
   - Modern CSS variables
   - Glass-morphism effects
   - Professional color scheme
   - Responsive design

2. **Reusable Components**
   - Movie cards
   - Loading spinners
   - Notification system
   - Button styles

3. **User Experience**
   - Smooth animations
   - Hover effects
   - Loading states
   - Error handling

### What We Adapted

**CSS Variables:**
```css
:root {
  --primary-color: #dc2626;
  --text-primary: #e0e0e0;  /* Changed from white to grey */
  --bg-primary: #1a1a1a;
  /* ... more variables */
}
```

**Movie Card Component:**
```css
.movie-card {
  background: var(--bg-primary);
  border-radius: 15px;
  transition: all 0.3s ease;
  /* ... DreadScale-inspired styling */
}
```

**Notification System:**
```javascript
// Imported from DreadScale
import { showNotification } from './utils/notifications.js';

// Used throughout the app
showNotification('Film chargé avec succès!', 'success');
```

### What We Didn't Use

- **Supabase integration** (not needed for TP1)
- **Authentication system** (not required)
- **Complex routing** (SPA routing not needed)
- **Advanced features** (ratings, watchlist, etc.)

---

## 📁 FILE ORGANIZATION IMPROVEMENT

### Problem We Identified
**Issue:** All JSON files were being saved in the root directory, making it messy and unprofessional.

**Before (messy):**
```
tp1node/
├── index.js
├── package.json
├── popular_movies.json      # ❌ Cluttering root
├── toprated_movies.json     # ❌ Cluttering root
├── movie_550.json          # ❌ Cluttering root
├── search_avatar.json      # ❌ Cluttering root
└── public/
```

### Solution We Implemented
**Created a dedicated `data/` directory for all JSON files.**

**After (clean):**
```
tp1node/
├── index.js
├── package.json
├── data/                   # ✅ Organized data folder
│   ├── popular_movies.json
│   ├── toprated_movies.json
│   ├── movie_550.json
│   └── search_avatar.json
└── public/
```

### Code Changes Made

**1. Updated all file writing operations:**
```javascript
// Before
fs.writeFile('popular_movies.json', JSON.stringify(data), callback)

// After
fs.writeFile('data/popular_movies.json', JSON.stringify(data), callback)
```

**2. Updated all file reading operations:**
```javascript
// Before
const filePath = `movie_${movieId}.json`

// After
const filePath = `data/movie_${movieId}.json`
```

**3. Moved existing files:**
```bash
mkdir data
move *.json data/
```

### Why This Matters for the Presentation

**Professional Development Practices:**
- **Separation of concerns** - Data files separate from code
- **Clean project structure** - Easier to navigate and maintain
- **Best practices** - Follows industry standards
- **Scalability** - Easy to add more data types

**Teacher Questions You Might Get:**
1. **"Why did you organize files this way?"**
   - "To separate data from code, making the project more maintainable and professional"
   - "It follows best practices for Node.js project structure"

2. **"How did you handle the existing files?"**
   - "I created a data directory and moved all existing JSON files there"
   - "Then updated all the file paths in the server code"

3. **"What's the benefit of this organization?"**
   - "Cleaner root directory, easier to find files, better for version control"
   - "If we had a database later, we could easily replace the data folder"

---

## 🐛 PROBLEMS WE SOLVED

### 1. Route Order Issue
**Problem:** `/fetch=popular` was being caught by `/fetch=:id`
**Solution:** Moved specific routes before generic ones

### 2. toLocaleString Error
**Problem:** Some movies don't have vote_count property
**Solution:** Added null checks before calling methods
```javascript
// Before (error-prone)
movie.vote_count.toLocaleString('fr-FR')

// After (safe)
movie.vote_count ? movie.vote_count.toLocaleString('fr-FR') : 'Non disponible'
```

### 3. Color Scheme Update
**Problem:** Pure white text was too harsh
**Solution:** Changed to grey tones for better readability
```css
--text-primary: #e0e0e0;  /* Light grey instead of white */
--text-secondary: #b0b0b0; /* Medium grey */
```

---

## 📚 KEY CONCEPTS TO EXPLAIN

### 1. Express Route Parameters
```javascript
app.get('/fetch=:id', (req, res) => {
    const movieId = req.params.id  // Extracts :id from URL
})
```

### 2. File System Operations
```javascript
// Write to file
fs.writeFile('filename.json', JSON.stringify(data), callback)

// Read from file
const data = JSON.parse(fs.readFileSync('filename.json', 'utf8'))
```

### 3. Environment Variables
```javascript
// config.js
const dotenv = require("dotenv")
dotenv.config()
module.exports = {
    PORT: process.env.PORT,
    API_KEY: process.env.API_KEY
}
```

### 4. API Integration
```javascript
// Make API request
request.get({url, json:true}, (err, response, data) => {
    // Handle response
})
```

### 5. Frontend-Backend Communication
```javascript
// Frontend fetches data
const response = await fetch(`/data/${movieId}`)
const movie = await response.json()

// Backend serves data
app.get('/data/:id', (req, res) => {
    res.json(movieData)
})
```

---

## 🎯 PRESENTATION TALKING POINTS

### 1. "Why did you choose TMDB API?"
- Public API with good documentation
- Allows parameterized requests (required)
- Provides both general and detailed information
- No complex authentication needed
- Rich movie data (posters, ratings, descriptions)

### 2. "How does your application work?"
1. User searches for movie or clicks category
2. Frontend sends request to Express server
3. Server makes API call to TMDB
4. Server saves response to JSON file
5. Server redirects to view page
6. Frontend fetches data from JSON file
7. Data is displayed in beautiful interface

### 3. "What's the difference between your routes?"
- `/fetch=:id` - Gets data from API and saves to JSON
- `/data/:id` - Reads data from JSON file and returns it
- This separation allows for caching and offline viewing

### 4. "Why did you add bonus features?"
- Better user experience (search by title vs ID)
- Demonstrates understanding of different API endpoints
- Shows ability to extend basic requirements
- More professional application

### 5. "How did you handle errors?"
- API error handling (network issues, invalid responses)
- File existence checks
- User input validation
- Frontend error display with user-friendly messages

---

## 🔍 POTENTIAL TEACHER QUESTIONS

### Technical Questions:
1. **"Explain the difference between your two main routes"**
   - `/fetch=:id` - External API → JSON file
   - `/data/:id` - JSON file → Frontend

2. **"Why did you use the request library instead of fetch?"**
   - Following teacher's FinanceRest pattern
   - Request is simpler for server-side API calls
   - Fetch is more modern but request works well

3. **"How do you handle the API key securely?"**
   - Stored in .env file (not in code)
   - Loaded via config.js
   - .env file is in .gitignore

4. **"What happens if the API is down?"**
   - Error handling returns 500 status
   - User sees error message
   - Application doesn't crash

### Design Questions:
1. **"Why did you change from ID search to title search?"**
   - More user-friendly
   - Users know movie titles, not IDs
   - Better user experience

2. **"How did you make it look modern?"**
   - Used DreadScale's design system
   - Glass-morphism effects
   - CSS variables for consistency
   - Responsive design

3. **"Why did you add categories?"**
   - TMDB provides category endpoints
   - Better movie discovery
   - Demonstrates multiple API usage

### Architecture Questions:
1. **"Why save to JSON files instead of database?"**
   - TP1 requirement
   - Simpler for this scope
   - Demonstrates file system operations
   - Allows offline viewing

2. **"How does your frontend get the data?"**
   - JavaScript fetch() to /data/:id endpoint
   - Async/await for clean code
   - Error handling for failed requests

---

## 🚀 DEMONSTRATION FLOW

### 1. Show Homepage
- "This is our modern homepage with search and categories"
- "We replaced the basic ID search with title search"
- "Added category buttons for better discovery"

### 2. Demonstrate Search
- Type "Fight Club" in search
- "This triggers our /search=:query route"
- "Server calls TMDB search API"
- "Results are saved to JSON and displayed"

### 3. Show Categories
- Click "Populaires"
- "This uses our /fetch=popular route"
- "Shows how we handle different API endpoints"

### 4. Show Movie Details
- Click on any movie card
- "This uses our required /fetch=:id route"
- "Shows detailed movie information"

### 5. Show File System
- Open project folder
- "Here are the JSON files we create"
- "Each API call saves data locally"

### 6. Show Code Structure
- Open index.js
- "Here are our two required routes"
- "Following the teacher's FinanceRest pattern"
- "Error handling and file operations"

---

## 💡 FINAL TIPS

1. **Be confident** - You built a complete, working application
2. **Explain the "why"** - Not just what you did, but why you did it
3. **Show the progression** - From basic requirements to bonus features
4. **Demonstrate understanding** - You can explain every line of code
5. **Highlight problem-solving** - Route order, error handling, etc.

**Remember:** You exceeded the requirements with a professional, modern application that demonstrates solid understanding of Node.js, Express, API integration, and frontend development!
