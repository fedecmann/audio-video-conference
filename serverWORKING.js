var express = require('express');
var app = express();
var path = require('path');

const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

app.get('*', function (req, res) {
    console.log(req);
    console.log('hello world !');
});

app.get('/', function (req, res) {
    console.log(req);
    console.log('hello world !');
    //	res.status(200).send({ error: "boo"});
    res.sendFile(join(__dirname + '/index.html'));
});

app.listen(PORT, function () {
    console.log(`Listening on ${PORT}`);
});