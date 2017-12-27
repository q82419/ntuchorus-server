var db = require('./db');
var log = require('./log');
var fblogin = require('./login');
var async = require('async');
var dateFormat = require('dateformat');
var TAG_a = "[ DEL  ADMIN ]"

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
                department = mnger[0]['department'];

            if(query['cmd'] == 'delSaleTicket' && (perm == 4 || department == 0)){
                deleteSaleTicket(fbid, query['data'], queryProgram, ip, callback);
            }
            else if(query['cmd'] == 'delCreditPay' && (perm == 4 || department == 0)){
                deleteCreditPay(fbid, query['data'], queryProgram, ip, callback);
            }
            else if(query['cmd'] == 'delProgram' && perm >= 3){
                //TODO
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

/* Delete sale record */
function deleteSaleTicket(fbid, data, pid, ip, callback){
    log.out.i(TAG_a, ip, "Delete sale record from: " + fbid);
    var deletePaylistString = 'DELETE FROM data' + pid + '_paylist WHERE id = ' + data['id'] + ';';
    var deleteCreditlistString = 'DELETE FROM data' + pid + '_creditlist WHERE saleid = ' + data['id'] + ';';
    var updateString = 'UPDATE data' + pid + '_ticket SET saleid = NULL WHERE saleid = ' + data['id'] + ';';
    db.dbQuery(deletePaylistString, callback, function(result){
        db.dbQuery(deleteCreditlistString, callback, function(result){
            db.dbQuery(updateString, callback, function(result){
                updateTimeStamp(pid, callback);
            });
        });
    });
}

/* Delete credit payment record */
function deleteCreditPay(fbid, data, pid, ip, callback){
    log.out.i(TAG_a, ip, "Delete credit payment record from: " + fbid);
    var deleteString = 'DELETE FROM data' + pid + '_creditlist WHERE id = ' + data['id'] + ';';
    db.dbQuery(deleteString, callback, function(result){
        updateTimeStamp(pid, callback);
    });
}
