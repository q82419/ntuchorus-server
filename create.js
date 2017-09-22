var db = require('./db');
var log = require('./log');
var fblogin = require('./login');
var async = require('async');
var dateFormat = require('dateformat');
var TAG_a = "[ CRE  ADMIN ]"

exports.proc = function(req, res){
    var query = JSON.parse(JSON.stringify(req.body));
    var reqip = req.headers['x-forwarded-for'] || 
                req.connection.remoteAddress || 
                req.socket.remoteAddress ||
                req.connection.socket.remoteAddress;
    checkPermission(query, reqip, function(result){
        res.end(JSON.stringify(result));
    });
};

function checkPermission(query, ip, callback){
    fblogin.check(query['id'], query['token'], ip, function(result){
        if(result['status'] == '0'){
            log.out.w(TAG_a, ip, "Facebook Permission Denied: " + result['id']);
            callback({"status": '2'});
        }
        else if(result['status'] == '-1'){
            log.out.e(TAG_a, ip, "Facebook Bad request: " + query['id']);
            callback({'status': '2'})
        }
        else{
            processCommand(query['id'], result['user'], result['status'], query, ip, callback);
        }
    });
}

function processCommand(fbid, mngdata, perm, query, ip, callback){
    var queryCurrProgram = 'SELECT * FROM mapattribute;';
    var queryGroupManager;
    db.dbQuery(queryCurrProgram, callback, function(rows){
        var currProgram = rows[0]['currentdataid'];
        var queryProgram = currProgram;
        if(query['programid'] != undefined)
            queryProgram = query['programid'];
        queryGroupManager = 'SELECT * FROM data' + queryProgram + '_manager WHERE managerid = ' + mngdata['id'] + ';';
        db.dbQuery(queryGroupManager, callback, function(mnger){
            var department = -1;
            if(mnger.length == 1)
                department = mnger['department'];

            if(query['cmd'] == 'creNewProgram' && perm >= 3){
                createNewProgram(fbid, query['data'], ip, callback);
            }
            else if(query['cmd'] == 'creSaleTicket' && (perm == 4 || department == 0)){
                createSaleTicket(fbid, query['data'], queryProgram, ip, callback);
            }
            else if(query['cmd'] == 'creCreditPay' && (perm == 4 || department == 0)){
            }
            else{
                log.out.w(TAG_a, ip, query['cmd'] + " Permission Denied: " + query['id']);
                callback({'status': '2'})
            }
        });
        
    });
}

function updateTimeStamp(pid, callback){
    var updateMsg = 'UPDATE mapcategory SET time = now() WHERE id = ' + pid + ';';
    db.dbQuery(updateMsg, callback, function(rows){
        callback({'status': '0'});
    });
}

/* Create new program tables */
function createNewProgram(fbid, data, ip, callback){
    log.out.i(TAG_a, ip, "Create new program tables from: " + fbid);
    var insertString = 'INSERT INTO mapcategory (year, season, title, mapid, message, time, dmsale, dmtotal, programsale, programprice, programcoupon) VALUES (' +
                       data['year'] + ', ' + data['season'] + ', "' + data['title'] + '", ' + data['mapid'] + ', "公告訊息", now(), 0, 0, 0, ' + data['programprice'] + ', 0);';
    db.dbQuery(insertString, callback, function(result){
        var createset = [];
        createset.push('CREATE TABLE data' + result.insertId + '_creditlist (id int NOT NULL AUTO_INCREMENT, saleid int, time date, price int, PRIMARY KEY (id));');
        createset.push('CREATE TABLE data' + result.insertId + '_manager (id int NOT NULL AUTO_INCREMENT, managerid int NOT NULL, department int NOT NULL, PRIMARY KEY (id));');
        createset.push('CREATE TABLE data' + result.insertId + '_paylist (id int NOT NULL AUTO_INCREMENT, buyer varchar(64), department int, saler int, time date, paymode int, discount int, PRIMARY KEY (id));');
        createset.push('CREATE TABLE data' + result.insertId + '_price (id int NOT NULL, price int NOT NULL, discount int NOT NULL, PRIMARY KEY(id));');
        createset.push('CREATE TABLE data' + result.insertId + '_ticket (id int NOT NULL AUTO_INCREMENT, floor int NOT NULL, row int NOT NULL, seat int NOT NULL, state int NOT NULL, type int NOT NULL, preserve int NOT NULL, saleid int, PRIMARY KEY (id));');
        for(var i = 0; i < data['manager'].length; i++)
            createset.push('INSERT INTO data' + result.insertId + '_manager (managerid, department) VALUES (' + data['manager'][i]['id'] + ', ' + data['manager'][i]['department'] + ');');
        for(var i = 0; i < data['price'].length; i++)
            createset.push('INSERT INTO data' + result.insertId + '_price VALUES (' + data['price'][i]['id'] + ', ' + data['price'][i]['price'] + ', ' + data['price'][i]['discount'] + ');');
        createset.push('INSERT INTO data' + result.insertId + '_ticket (floor, row, seat, state, type, preserve) SELECT floor, row, seat, state, type, preserve FROM mapinit' + data['mapid'] + ';');
        createset.push('UPDATE mapattribute SET currentdataid = ' + result.insertId + ', isshowhidden = 0 WHERE id = 1;');
        var createsetfunction = [];
        createset.forEach(function(item){
            createsetfunction.push(function(next){
                db.dbQuery(createset[it], callback, function(rows){
                    it++;
                    next();
                });
            });
        });
        
        var it = 0;
        async.waterfall(createsetfunction, function(err, result) {
            callback({'status': '0'});
        });
    });
}

/* Create add new sale record */
function createSaleTicket(fbid, data, pid, ip, callback){
    log.out.i(TAG_a, ip, "Create add sale record from: " + fbid);
    var idList = JSON.stringify(data['id']).replace('[', '(').replace(']', ')');
    data['buyer'] = data['buyer'].split('\\').join('\\\\').split('\"').join('\\\"').split('\'').join('\\\'');
    var insertString = 'INSERT INTO data' + pid + '_paylist (buyer, department, saler, time, paymode, discount) VALUES ("' +
                       data['buyer'] + '", ' + data['department'] + ', ' + data['saler'] + ', "' + data['time'] + '", ' + data['paymode'] + ', ' + data['discount'] + ');';
    db.dbQuery(insertString, callback, function(result){
        var updateString = 'UPDATE data' + pid + '_ticket SET saleid = ' + result.insertId + ' WHERE id in ' + idList + ';';
        db.dbQuery(updateString, callback, function(rows){
            updateTimeStamp(pid, callback);
        });
    });
}
