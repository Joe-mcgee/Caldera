/*eslint max-params: 0 */ // --> OFF
const http = require('http');
const Server = http.Server;
const express = require('express');
const bodyParser = require('body-parser');
const uuid4 = require('uuid4')

const app = express();
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.engine('html', require('ejs').renderFile);

const artistRouter = require('./routers/artist-router');
const archiveRouter = require('./routers/archive-router');
app.use('/', artistRouter())
app.use('/', archiveRouter())
app.set('view engine', 'html');
const httpServer = new Server(app);

app.get('/', (req, res) => {
  res.render('home');;
});

if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(3000, () => {
  console.log('listening on 3000');
});

}

