var db = require('./db');
var log = require('./log');
var fb = require('fb');
var TAG = "[ CHECK   FB ]";

fb.options({version: 'v2.8', appId: '[FACEBOOK_APP_ID]', appSecret: 'FACEBOOK_APP_SECRET'});
// Result -1: Error, others: Permission_Num

module.exports = {
    check : function(id, token, ip, callback){
        checkFBLoginState(id, token, ip, callback);
    }
};

function checkFBLoginState(vid, vtoken, ip, callback){
    if(vid == undefined)
        callback({'status': '-1'});
    else{
        fb.api('me', { fields: ['id', 'name'], access_token: vtoken }, function (res) {
            if(res == undefined){
                log.out.e(TAG, ip, "Access Token Checking Failed: " + vid);
                callback({'status': '-1'});
            }
            else{
                queryManager(res.id, res.name, ip, function(result){
                    callback(result);
                });
            }
        });
    }
}

function queryManager(vid, vname, ip, callback){
    var queryString = 'SELECT * FROM manager WHERE fbid = "' + vid + '";' ;
    db.dbQuery(queryString, callback, function(rows){
        if(rows.length != 1){
            log.out.i(TAG, ip, "New Facebook id: " + vid);
            addManager(vid, vname, callback);
        }
        else{
            callback({'status': rows[0]['permission'], 'fbid': rows[0]['fbid'], 'id': rows[0]['id']});
        }
    });
}

function addManager(vid, vname, callback){
    var queryString = 'INSERT INTO manager (fbid, name, permission) VALUES (' + vid + ', ' + '"' + vname + '", 0);';
    db.dbQuery(queryString, callback, function(rows){
        callback({'status': '0', 'id': 'new member'});
    });
}
