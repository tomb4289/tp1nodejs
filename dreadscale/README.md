# DreadScale - Movie Rating Platform

A modern web application for discovering and rating movies with detailed content analysis.

## Features

- 🎬 Browse and search movies from TMDB database
- ⭐ Rate movies across multiple content categories
- 📋 Personal watchlist management
- 💬 Movie discussion and comments
- 🔍 Advanced search with content filtering
- 👤 User accounts and profiles
- 🌙 Dark/Light theme support

## Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd dreadscale
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Supabase Database**
   - Create a new project at [https://supabase.com](https://supabase.com)
   - Go to Project Settings > API to get your project URL and anon key
   - The database migrations will be applied automatically when you connect

4. **Configure environment variables**
   - Copy `.env.example` to `.env`
   - Get your TMDB API key from [https://www.themoviedb.org/settings/api](https://www.themoviedb.org/settings/api)
   - Get your OMDb API key from [http://www.omdbapi.com/apikey.aspx](http://www.omdbapi.com/apikey.aspx) (free)
   - Add your API keys to the `.env` file:
     ```
     VITE_TMDB_API_KEY=your_actual_api_key_here
     VITE_OMDB_API_KEY=your_omdb_api_key_here
     VITE_SUPABASE_URL=your_supabase_project_url
     VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
     ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Build for production**
   ```bash
   npm run build
   ```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_TMDB_API_KEY` | Your TMDB API key for fetching movie data | Yes |
| `VITE_OMDB_API_KEY` | Your OMDb API key for IMDb and Rotten Tomatoes ratings | No* |
| `VITE_SUPABASE_URL` | Your Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous key | Yes |
| `VITE_SENTRY_DSN` | Sentry DSN for error monitoring | No |
| `VITE_APP_VERSION` | App version for release tracking | No |
| `RESEND_API_KEY` | Resend API key for sending contact form emails | No** |

*If OMDb API key is not provided, mock ratings will be generated for demonstration purposes.
**Required for contact form functionality. Set this in your Supabase project's Edge Functions secrets.

## Database Setup

DreadScale uses Supabase (PostgreSQL) for data persistence. The database schema includes:

- **Users & Profiles**: User authentication and profile management
- **Movies**: Cached movie data from TMDB
- **Ratings**: Detailed content ratings across multiple categories
- **Reviews**: Text reviews with spoiler flags and helpfulness voting
- **Watchlists**: Personal movie collections
- **Chat Messages**: Movie discussion threads

### Database Migrations

The database schema is automatically created through Supabase migrations located in `/supabase/migrations/`. These include:

1. User profiles and authentication
2. Movie data caching
3. Multi-dimensional rating system
4. Review and discussion system
5. Watchlist management
6. Aggregated views for performance

## API Key Setup

### TMDB API
1. Visit [TMDB](https://www.themoviedb.org/)
2. Create an account or sign in
3. Go to Settings > API
4. Request an API key (choose "Developer" option)
5. Copy your API key to the `.env` file

### OMDb API (for IMDb and Rotten Tomatoes ratings)
1. Visit [OMDb API](http://www.omdbapi.com/)
2. Click "API Key" to get a free key
3. Choose the free tier (1,000 requests per day)
4. Verify your email and get your API key
5. Add it to your `.env` file as `VITE_OMDB_API_KEY`

### Supabase Setup
1. Create a new project at [Supabase](https://supabase.com)
2. Go to Project Settings > API
3. Copy your Project URL and anon/public key
4. Add them to your `.env` file
5. The database tables will be created automatically when you first run the app

## Error Monitoring (Optional)

DreadScale includes optional Sentry integration for error monitoring and performance tracking:

1. Create a [Sentry account](https://sentry.io/)
2. Create a new project for your application
3. Copy the DSN from your project settings
4. Add it to your `.env` file as `VITE_SENTRY_DSN`

Sentry will automatically:
- Track JavaScript errors and exceptions
- Monitor API call failures
- Record user interactions and navigation
- Provide performance insights
- Alert you to issues in production

## Project Structure

```
src/
├── lib/             # Core services and utilities
│   ├── supabase.js       # Supabase client and helpers
│   ├── auth-supabase.js  # Authentication service
│   └── ratings-supabase.js # Ratings service
├── styles/          # Modular CSS files
├── utils/           # Utility functions
│   ├── notifications.js  # User notifications
│   └── sentry.js         # Error monitoring
├── auth.js          # Authentication system
├── movies.js        # Movie data and search
├── ratings.js       # Content rating system
├── watchlist.js     # Personal watchlist
├── chat.js          # Movie discussions
├── router.js        # Client-side routing
├── navigation.js    # Navigation handling
├── theme.js         # Theme switching
└── main.js          # Application entry point

supabase/
├── migrations/      # Database schema migrations
│   ├── create_users_table.sql
│   ├── create_movies_table.sql
│   ├── create_ratings_table.sql
│   ├── create_watchlists_table.sql
│   ├── create_reviews_table.sql
│   ├── create_chat_messages_table.sql
│   └── create_rating_aggregates_view.sql
```

## Technologies Used

- **Frontend**: Vanilla JavaScript, CSS3, HTML5
- **Build Tool**: Vite
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth
- **API**: The Movie Database (TMDB)
- **Error Monitoring**: Sentry (optional)
- **Storage**: Supabase (PostgreSQL) for persistent data
- **Styling**: Custom CSS with CSS Variables for theming

## Features

### Current Features
- 🎬 Browse and search movies from TMDB database
- ⭐ Multi-dimensional content rating system (Violence, Sexual Content, Language, Disturbing Themes)
- 📋 Personal watchlist management with import/export
- 💬 Movie discussion threads
- 🔍 Advanced search with content filtering
- 👤 User accounts and profiles with Supabase authentication
- 🌙 Dark/Light theme support
- 📱 Fully responsive design

### Upcoming Features (Enabled by Database)
- 🤖 **Personalized Recommendations**: Collaborative filtering based on user rating similarity
- 📝 **Text Reviews**: Full review system with spoiler flags and helpfulness voting
- 📊 **Advanced Analytics**: Rating trends, user statistics, and content insights
- 🏆 **User Achievements**: Badges for rating milestones and community participation
- 🔔 **Real-time Notifications**: Updates on new reviews, replies, and recommendations

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.