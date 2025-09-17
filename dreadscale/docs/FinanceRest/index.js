const express = require('express')
const app = express();
const config = require('./config.js')
const request = require('request')
const fs = require('fs')


app.get('/ticker=:id', (req, res) => {
    const ticker = req.params.id
    
    var url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${ticker}&interval=5min&apikey=${config.API_KEY}`;

    request.get({url, json:true}, (err, response, data) => {
        if(err || response.statusCode != 200) {
            return res.status(500).send('Error fetching data')
        }
        //console.log(data)
        fs.writeFile(`${ticker}.json`, JSON.stringify(data), () => {
            res.send('Success')
        })
    })
})

app.listen(config.PORT, () => {
    console.log('Connecté abcdef')
})