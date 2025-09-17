const express = require('express')
const app = express();
const config = require('./config.js')
const request = require('request')
const fs = require('fs')
const path = require('path')

app.use(express.static('public'))

app.get('/fetch=popular', (req, res) => {
    var url = `https://api.themoviedb.org/3/movie/popular?api_key=${config.API_KEY}&language=fr-FR`;

    request.get({url, json:true}, (err, response, data) => {
        if(err || response.statusCode != 200) {
            return res.status(500).send('Error fetching data')
        }
        fs.writeFile('data/popular_movies.json', JSON.stringify(data), () => {
            res.redirect('/view?type=popular')
        })
    })
})

app.get('/fetch=toprated', (req, res) => {
    var url = `https://api.themoviedb.org/3/movie/top_rated?api_key=${config.API_KEY}&language=fr-FR`;

    request.get({url, json:true}, (err, response, data) => {
        if(err || response.statusCode != 200) {
            return res.status(500).send('Error fetching data')
        }
        fs.writeFile('data/toprated_movies.json', JSON.stringify(data), () => {
            res.redirect('/view?type=toprated')
        })
    })
})

app.get('/fetch=nowplaying', (req, res) => {
    var url = `https://api.themoviedb.org/3/movie/now_playing?api_key=${config.API_KEY}&language=fr-FR`;

    request.get({url, json:true}, (err, response, data) => {
        if(err || response.statusCode != 200) {
            return res.status(500).send('Error fetching data')
        }
        fs.writeFile('data/nowplaying_movies.json', JSON.stringify(data), () => {
            res.redirect('/view?type=nowplaying')
        })
    })
})

app.get('/search=:query', (req, res) => {
    const query = req.params.query
    
    var url = `https://api.themoviedb.org/3/search/movie?api_key=${config.API_KEY}&language=fr-FR&query=${encodeURIComponent(query)}`;

    request.get({url, json:true}, (err, response, data) => {
        if(err || response.statusCode != 200) {
            return res.status(500).send('Error fetching data')
        }
        fs.writeFile(`data/search_${query.replace(/[^a-zA-Z0-9]/g, '_')}.json`, JSON.stringify(data), () => {
            res.redirect(`/view?search=${encodeURIComponent(query)}`)
        })
    })
})

app.get('/fetch=:id', (req, res) => {
    const movieId = req.params.id
    
    var url = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${config.API_KEY}&language=fr-FR`;

    request.get({url, json:true}, (err, response, data) => {
        if(err || response.statusCode != 200) {
            return res.status(500).send('Error fetching data')
        }
        fs.writeFile(`data/movie_${movieId}.json`, JSON.stringify(data), () => {
            res.redirect(`/view?id=${movieId}`)
        })
    })
})

app.get('/data/:id', (req, res) => {
    const movieId = req.params.id
    const filePath = `data/movie_${movieId}.json`
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Movie data not found' })
    }
    
    const movieData = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    res.json(movieData)
})

app.get('/data/type/:type', (req, res) => {
    const type = req.params.type
    const filePath = `data/${type}_movies.json`
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Movies data not found' })
    }
    
    const moviesData = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    res.json(moviesData)
})

app.get('/data/search/:query', (req, res) => {
    const query = req.params.query
    const filePath = `data/search_${query.replace(/[^a-zA-Z0-9]/g, '_')}.json`
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Search data not found' })
    }
    
    const searchData = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    res.json(searchData)
})

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

app.get('/view', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'view.html'))
})

app.listen(config.PORT, () => {
    console.log('Connecté abcdef')
})
