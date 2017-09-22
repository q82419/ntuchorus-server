var db = require('./db');
var log = require('./log');
var fblogin = require('./login');
var async = require('async');
var dateFormat = require('dateformat');
var TAG_g = "[ REQ  GUEST ]"
var TAG_m = "[ REQ  MANAG ]"
var TAG_a = "[ REQ  ADMIN ]"

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
    if(query['id'] == 'guest'){
        processCommand('guest', 0, query, ip, callback);
    }
    else{
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
                processCommand(query['id'], result, query, ip, callback);
            }
        });
    }
}

function processCommand(fbid, res, query, ip, callback){
    var queryCurrProgram = 'SELECT * FROM mapattribute;';
    db.dbQuery(queryCurrProgram, callback, function(rows){
        var currProgram = rows[0]['currentdataid'];
        var queryProgram = currProgram;
        if(query['programid'] != undefined)
            queryProgram = query['programid'];
        var isShowHidden = rows[0]['isshowhidden'];

        if(query['cmd'] == 'reqMap'){
            requestGraph('guest', res['status'], queryProgram, isShowHidden, res['user'], ip, callback);
        }
        else if(query['cmd'] == 'reqTicket' && res['status'] >= 1){
            requestGraph(fbid, res['status'], queryProgram, isShowHidden, res['user'], ip, callback);
        }
        else if(query['cmd'] == 'reqOrder' && res['status'] >= 2){
            requestOrder(fbid, queryProgram, res['user'], ip, callback);
        }
        else if(query['cmd'] == 'reqTotal' && res['status'] >= 2){
            requestTotal(fbid, queryProgram, res['user'], ip, callback);
        }
        else if(query['cmd'] == 'reqNewCategory' && res['status'] >= 3){
            requestNewCategory(fbid, queryProgram, res['user'], ip, callback);
        }
        else{
            log.out.w(TAG_m, ip, query['cmd'] + " Permission Denied: " + query['id']);
            callback({'status': '2'});
        }
    });
}

function doRequestTasks(queryset, callback){
    var resultset = {'status': '0'};
    var updateCounter = 'UPDATE mapattribute SET counter = counter + 1 WHERE id = 1;';
    db.dbQuery(updateCounter, callback, function(res){
        async.each(Object.keys(queryset), function (item, next) {
            db.dbQuery(queryset[item], callback, function(rows){
                resultset[item] = rows;
                next();
            });
        }, function(err){
            callback(resultset);
        });
    });
}

/* Request ticket data in this program */
function requestGraph(fbid, perm, pid, showhidden, user, ip, callback){
    var queryset = { 'mapattribute' : 'SELECT * FROM mapattribute;',
                     'category'     : 'SELECT * FROM mapcategory;',
                     'ticket'       : 'SELECT * FROM data' + pid + '_ticket;',
                     'price'        : 'SELECT * FROM data' + pid + '_price;'
                   };

    /* Check permission */
    if(perm == 0){
        log.out.i(TAG_g, ip, "Request ticket map from: guest");
    }
    else{
        queryset['progmanager'] = 'SELECT manager.id AS id, department, name FROM data' + pid + '_manager, manager WHERE data' + pid + '_manager.managerid = manager.id ORDER BY department ASC;';
        queryset['manager'] = 'SELECT * FROM manager;';
        log.out.i(TAG_m, ip, "Request ticket map from: " + fbid);
    }

    /* Check showhidden */
    if(showhidden == 0)
        queryset['percentage'] = 'SELECT type, state, count(*) AS num FROM data' + pid + '_ticket WHERE preserve = 0 GROUP BY type, state;';
    else
        queryset['percentage'] = 'SELECT type, state, count(*) AS num FROM data' + pid + '_ticket WHERE preserve = 0 or preserve = 2 or preserve = 3 GROUP BY type, state;';

    doRequestTasks(queryset, function(data){
        for(var i in data['category'])
            data['category'][i]['time'] = dateFormat(data['category'][i]['time'], "yyyy/mm/dd HH:MM:ss");
        data['user'] = user;
        callback(data);
    });
}

/* Request total order data in this program */
function requestOrder(fbid, pid, user, ip, callback){
    log.out.i(TAG_a, ip, "Request full orders from: " + fbid);
    var queryset = { 'mapattribute' : 'SELECT * FROM mapattribute;',
                     'category'     : 'SELECT * FROM mapcategory;',
                     'ticket'       : 'SELECT * FROM data' + pid + '_ticket;',
                     'price'        : 'SELECT * FROM data' + pid + '_price;',
                     'progmanager'  : 'SELECT manager.id AS id, department, name FROM data' + pid + '_manager, manager WHERE data' + pid + '_manager.managerid = manager.id ORDER BY department ASC;',
                     'manager'      : 'SELECT * FROM manager;',
                     'paylist'      : 'SELECT id, buyer, department, saler, DATE_FORMAT(time, \'%Y-%m-%d\') as time, paymode, discount FROM data' + pid + '_paylist;',
                     'creditlist'   : 'SELECT * FROM data' + pid + '_creditlist;'
                   };

    doRequestTasks(queryset, function(data){
        for(var i in data['category'])
            data['category'][i]['time'] = dateFormat(data['category'][i]['time'], "yyyy/mm/dd HH:MM:ss");
        data['user'] = user;
        callback(data);
    });
}

/* Request total statistic data in this program */
function requestTotal(fbid, pid, user, ip, callback){
    log.out.i(TAG_a, ip, "Request program statistics from: " + fbid);
    var queryset = { 'mapattribute'  : 'SELECT * FROM mapattribute;',
                     'category'      : 'SELECT * FROM mapcategory;',
                     'price'         : 'SELECT * FROM data' + pid + '_price;',
                     'paylist'      : 'SELECT id, buyer, department, saler, DATE_FORMAT(time, \'%Y-%m-%d\') as time, paymode, discount FROM data' + pid + '_paylist;',
                     'queryManager'  : 'SELECT * FROM manager;',
                     'queryString_1' : 'SELECT preserve, type, state, COUNT(*) AS num FROM data' + pid + '_ticket GROUP BY preserve, type, state;',
                     'queryString_2a': 'SELECT DATE_FORMAT(data' + pid + '_paylist.time, \'%Y-%m-%d\') AS date, ' +
                                              'SUM(IF(data' + pid + '_ticket.type = 0, 1, 0)) AS type0, ' + 
                                              'SUM(IF(data' + pid + '_ticket.type = 1, 1, 0)) AS type1, ' + 
                                              'SUM(IF(data' + pid + '_ticket.type = 2, 1, 0)) AS type2, ' + 
                                              'SUM(IF(data' + pid + '_ticket.type = 3, 1, 0)) AS type3, ' + 
                                              'SUM(0) AS discount, ' + 
                                              'SUM(data' + pid + '_price.price * IF(data' + pid + '_ticket.preserve < 5, data' + pid + '_price.discount, 1) / 100) AS totalprice ' +
                                       'FROM data' + pid + '_paylist, data' + pid + '_ticket, data' + pid + '_price ' + 
                                       'WHERE data' + pid + '_ticket.saleid = data' + pid + '_paylist.id and data' + pid + '_paylist.paymode = 0 and data' + pid + '_ticket.type = data' + pid + '_price.id ' +
                                       'GROUP BY data' + pid + '_paylist.time;',
                     'queryString_2b': 'SELECT DATE_FORMAT(data' + pid + '_paylist.time, \'%Y-%m-%d\') AS date, ' +
                                              'SUM(IF(data' + pid + '_ticket.type = 0, 1, 0)) AS type0, ' + 
                                              'SUM(IF(data' + pid + '_ticket.type = 1, 1, 0)) AS type1, ' + 
                                              'SUM(IF(data' + pid + '_ticket.type = 2, 1, 0)) AS type2, ' + 
                                              'SUM(IF(data' + pid + '_ticket.type = 3, 1, 0)) AS type3, ' + 
                                              'SUM(0) AS discount, ' + 
                                              'SUM(data' + pid + '_price.price * IF(data' + pid + '_ticket.preserve < 5, data' + pid + '_price.discount, 1) / 100) AS totalprice ' +
                                       'FROM data' + pid + '_paylist, data' + pid + '_ticket, data' + pid + '_price ' + 
                                       'WHERE data' + pid + '_ticket.saleid = data' + pid + '_paylist.id and data' + pid + '_paylist.paymode = 1 and data' + pid + '_ticket.type = data' + pid + '_price.id ' +
                                       'GROUP BY data' + pid + '_paylist.time;',
                     'queryString_2c': 'SELECT DATE_FORMAT(time, \'%Y-%m-%d\') AS date, SUM(discount) AS discount ' + 
                                       'FROM data' + pid + '_paylist ' + 
                                       'WHERE data' + pid + '_paylist.paymode = 0 ' +
                                       'GROUP BY data' + pid + '_paylist.time;',
                     'queryString_2d': 'SELECT DATE_FORMAT(time, \'%Y-%m-%d\') AS date, SUM(discount) AS discount ' + 
                                       'FROM data' + pid + '_paylist ' + 
                                       'WHERE data' + pid + '_paylist.paymode = 1 ' +
                                       'GROUP BY data' + pid + '_paylist.time;',
                     'queryString_4a': 'SELECT data' + pid + '_paylist.buyer AS buyer, ' +
                                              'data' + pid + '_paylist.department AS department, ' +
                                              'SUM(IF(data' + pid + '_ticket.type = 0, 1, 0)) AS type0, ' +
                                              'SUM(IF(data' + pid + '_ticket.type = 1, 1, 0)) AS type1, ' +
                                              'SUM(IF(data' + pid + '_ticket.type = 2, 1, 0)) AS type2, ' +
                                              'SUM(IF(data' + pid + '_ticket.type = 3, 1, 0)) AS type3, ' +
                                              'SUM(0) AS discount, ' +
                                              'SUM(data' + pid + '_price.price * IF(data' + pid + '_ticket.preserve < 5, data' + pid + '_price.discount, 1) / 100) AS totalprice, ' +
                                              'SUM(IF(data' + pid + '_paylist.paymode = 1, data' + pid + '_price.price * IF(data' + pid + '_ticket.preserve < 5, data' + pid + '_price.discount, 1) / 100, 0)) AS oweprice ' +
                                       'FROM data' + pid + '_paylist, data' + pid + '_ticket, data' + pid + '_price ' + 
                                       'WHERE data' + pid + '_ticket.saleid = data' + pid + '_paylist.id and data' + pid + '_ticket.type = data' + pid + '_price.id ' +
                                       'GROUP BY buyer ' +
                                       'ORDER BY totalprice DESC;',
                     'queryString_4b': 'SELECT data' + pid + '_paylist.buyer AS buyer, SUM(price) AS price ' +
                                       'FROM data' + pid + '_creditlist, data' + pid + '_paylist ' +
                                       'WHERE data' + pid + '_paylist.id = data' + pid + '_creditlist.saleid GROUP BY buyer;',
                     'queryString_4c': 'SELECT buyer, SUM(discount) AS discount ' + 
                                       'FROM data' + pid + '_paylist ' + 
                                       'GROUP BY buyer;',
                     'queryString_5a': 'SELECT data' + pid + '_paylist.id AS id, ' +
                                              'data' + pid + '_paylist.buyer AS buyer, ' +
                                              'data' + pid + '_paylist.department AS department, ' +
                                              'DATE_FORMAT(data' + pid + '_paylist.time, \'%Y-%m-%d\') AS date, ' +
                                              'data' + pid + '_paylist.saler AS saler, ' +
                                              'SUM(IF(data' + pid + '_ticket.type = 0, 1, 0)) AS type0, ' +
                                              'SUM(IF(data' + pid + '_ticket.type = 1, 1, 0)) AS type1, ' +
                                              'SUM(IF(data' + pid + '_ticket.type = 2, 1, 0)) AS type2, ' +
                                              'SUM(IF(data' + pid + '_ticket.type = 3, 1, 0)) AS type3, ' +
                                              'data' + pid + '_paylist.paymode AS paymode, ' +
                                              'data' + pid + '_paylist.discount AS discount, ' +
                                              'SUM(data' + pid + '_price.price * IF(data' + pid + '_ticket.preserve < 5, data' + pid + '_price.discount, 1) / 100) AS totalprice, ' +
                                              'SUM(IF(data' + pid + '_paylist.paymode = 1, data' + pid + '_price.price * IF(data' + pid + '_ticket.preserve < 5, data' + pid + '_price.discount, 1) / 100, 0)) AS oweprice ' +
                                       'FROM data' + pid + '_paylist, data' + pid + '_ticket, data' + pid + '_price ' + 
                                       'WHERE data' + pid + '_ticket.saleid = data' + pid + '_paylist.id and data' + pid + '_ticket.type = data' + pid + '_price.id ' + 
                                       'GROUP BY data' + pid + '_paylist.id ' +
                                       'ORDER BY id;',
                     'queryString_5b': 'SELECT data' + pid + '_paylist.id AS saleid, SUM(price) AS price ' +
                                       'FROM data' + pid + '_creditlist, data' + pid + '_paylist ' +
                                       'WHERE data' + pid + '_paylist.id = data' + pid + '_creditlist.saleid GROUP BY saleid;',
                   };

    doRequestTasks(queryset, function(data){
        for(var i in data['category'])
            data['category'][i]['time'] = dateFormat(data['category'][i]['time'], "yyyy/mm/dd HH:MM:ss");
        data['user'] = user;
        callback(data);
    });
}

/* Request for create a new program category */
function requestNewCategory(fbid, pid, user, ip, callback){
    log.out.i(TAG_a, ip, "Request new category from: " + fbid);
    var queryset = { 'mapattribute' : 'SELECT * FROM mapattribute;',
                     'category'     : 'SELECT * FROM mapcategory;',
                     'price'        : 'SELECT * FROM data' + pid + '_price;',
                     'manager'      : 'SELECT * FROM manager ORDER BY id DESC;',
                     'mapindex'     : 'SELECT * FROM mapindex;',
                   };

    doRequestTasks(queryset, function(data){
        data['user'] = user;
        callback(data);
    });
}
