var db = require('./db');
var log = require('./log');
var fblogin = require('./login');
var async = require('async');
var dateFormat = require('dateformat');
var TAG_m = "[ UPD  MANAG ]"
var TAG_a = "[ UPD  ADMIN ]"

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
            log.out.w(TAG_m, ip, "Facebook Permission Denied: " + result['id']);
            callback({"status": '2'});
        }
        else if(result['status'] == '-1'){
            log.out.e(TAG_m, ip, "Facebook Bad request: " + query['id']);
            callback({'status': '2'})
        }
        else{
            processCommand(query['id'], result['id'], result['status'], query, ip, callback);
        }
    });
}

function processCommand(fbid, mngid, perm, query, ip, callback){
    var queryCurrProgram = 'SELECT * FROM mapattribute;';
    var queryGroupManager;
    db.dbQuery(queryCurrProgram, callback, function(rows){
        var currProgram = rows[0]['currentdataid'];
        var queryProgram = currProgram;
        if(query['programid'] != undefined)
            queryProgram = query['programid'];
        queryGroupManager = 'SELECT * FROM data' + queryProgram + '_manager WHERE managerid = ' + mngid + ';'
        db.dbQuery(queryGroupManager, callback, function(mnger){
            var department = -1;
            if(mnger.length == 1)
                department = mnger['department'];

            if(query['cmd'] == 'updSettings' && perm >= 3){
                updateSettings(fbid, query['data'], ip, callback);
            }
            else if(query['cmd'] == 'updManager' && perm >= 3){
                updateManager(fbid, perm, query['data'], ip, callback);
            }
            else if(query['cmd'] == 'updAttribute' && (perm == 4 || department == 0)){
                updateAttribute(fbid, query['data'], queryProgram, ip, callback);
            }
            else if(query['cmd'] == 'updSaleInformation' && (perm == 4 || department == 0)){
                // Order edit
            }
            else if(query['cmd'] == 'updClearPreserve' && (perm == 4 || department == 0)){
                updateClearPreserve(fbid, queryProgram, ip, callback);
            }
            else if(query['cmd'] == 'updSetTicket' && (perm == 4 || department == 0)){
                updateSetTicket(fbid, query['data'], queryProgram, ip, callback);
            }
            else if(query['cmd'] == 'updDraw' && (perm == 4 || department != -1)){
                updateDraw(fbid, query['data'], query['mode'], queryProgram, ip, callback);
            }
            else{
                log.out.w(TAG_m, ip, query['cmd'] + " Permission Denied: " + query['id']);
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

/* Update settings */
function updateSettings(fbid, data, ip, callback){
    log.out.i(TAG_a, ip, "Update settings from: " + fbid);
    var updateString = 'UPDATE mapattribute set currentdataid = ' + data['currentdataid'] + ', isshowhidden = ' + data['isshowhidden'] + ' WHERE id = 1;';
    db.dbQuery(updateString, callback, function(res){   
        callback({'status': '0'});
    });
}

/* Update manager name and permission */
function updateManager(fbid, perm, data, ip, callback){
    log.out.i(TAG_a, ip, "Update manager from: " + fbid);
    var queryManager = 'SELECT * from manager;';
    db.dbQuery(queryManager, callback, function(res){   
        var idList = {};
        for(var i = 0; i < res.length; i++)
            idList[res[i]['id']] = res[i];
        async.each(Object.keys(data), function (item, next) {
            data[item]['name'] = data[item]['name'].split('\\').join('\\\\').split('\"').join('\\\"').split('\'').join('\\\'');
            if(idList[item]['permission'] <= perm || idList[item]['fbid'] == fbid ){
                var updateString = 'UPDATE manager SET name = "' + data[item]['name'] + '", permission = ' + data[item]['permission'] + ' WHERE id = ' + item + ';';
                db.dbQuery(updateString, callback, function(rows){ next(); });
            }
            else
                next();
        }, function(){
            callback({'status': '0'});
        });
    });
}

/* Update message, DM sale, program sale */
function updateAttribute(fbid, data, pid, ip, callback){
    log.out.i(TAG_a, ip, "Update attribute from: " + fbid);
    data['message'] = data['message'].split('\\').join('\\\\').split('\"').join('\\\"').split('\'').join('\\\'');
    var updateString = 'UPDATE mapcategory SET message = "' + data['message'] + '", dmsale = ' + data['dmsale'] +
                                            ', dmtotal = ' + data['dmtotal'] + ', programsale = ' + data['programsale'] +
                                            ', programcoupon = ' + data['programcoupon'] + ' WHERE id = ' + pid + ';';
    db.dbQuery(updateString, callback, function(rows){
        updateTimeStamp(pid, callback);
    });
}

/* Update clear all ticket preserve */
function updateClearPreserve(fbid, pid, ip, callback){
    log.out.i(TAG_a, ip, "Update clear preserve from: " + fbid);
    var updateString = 'UPDATE data' + pid + '_ticket SET state = 0 WHERE state = 1;';
    db.dbQuery(updateString, callback, function(rows){
        updateTimeStamp(pid, callback);
    });
}

/* Update set ticket type and preserve */
function updateSetTicket(fbid, data, pid, ip, callback){
    log.out.i(TAG_a, ip, "Update set ticket from: " + fbid);
    async.each(Object.keys(data), function (item, next) {
        var updateString = 'UPDATE data' + pid + '_ticket SET type = ' + data[item]['type'] + ', preserve = ' + data[item]['preserve'] + ' WHERE id = ' + data[item]['id'] + ';';
        db.dbQuery(updateString, callback, function(rows){ next(); });
    }, function(){
        updateTimeStamp(pid, callback);
    });
}

/* Update draw ticket */
function updateDraw(fbid, data, mode, pid, ip, callback){
    log.out.i(TAG_m, ip, "Update draw ticket from: " + fbid);
    var idList = JSON.stringify(data).replace('[', '(').replace(']', ')');
    var queryTicket = 'SELECT * from data' + pid + '_ticket WHERE id in ' + idList + ';';
    var ticketList = [[], [], []];
    db.dbQuery(queryTicket, callback, function(rows){
        for(var i = 0; i < rows.length; i++){
            if(rows[i]['saleid'] == null)
                ticketList[rows[i]['state']].push(rows[i]['id']);
        }

        var updateString, updateList, updateListString;
        if(mode == 0)
            updateList = ticketList[1].concat(ticketList[2]);
        else if(mode == 1)
            updateList = ticketList[0];
        else if(mode == 2)
            updateList = ticketList[0].concat(ticketList[1]);
        else
            callback({'status': '1'});
        if(updateList.length > 0){
            updateListString = JSON.stringify(updateList).replace('[', '(').replace(']', ')');
            updateString = 'UPDATE data' + pid + '_ticket SET state = ' + mode + ' WHERE id in ' + updateListString + ';';
            db.dbQuery(updateString, callback, function(rows){
                updateTimeStamp(pid, callback);
            });
        }
        else
            callback({'status': '0'});
    });
}

