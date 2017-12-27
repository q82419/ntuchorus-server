var express = require('express');
var cors = require('cors');
var bodyParser = require('body-parser');
var app = express();
app.use(bodyParser.json());
app.use(cors());

// Import Files
var app_create = require('./create');
var app_request = require('./request');
var app_update = require('./update');
var app_delete = require('./delete');
var log = require('./log');

// SQL Connection
var mysql = require('mysql');

// Routing
app.post('/create', app_create.proc);
app.post('/request', app_request.proc);
app.post('/update', app_update.proc);
app.post('/delete', app_delete.proc);

app.listen((process.env.PORT || 3000), function () {
    log.out.i('[   SYSTEM   ]', 'LocalHost', 'NTUChorus Server Listening on Port 3000');
});

