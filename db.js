var mysql = require('mysql');
var log = require('./log');
var TAG = "[ SYS--MYSQL ]";
var TAGcolor = 23;

var pool = mysql.createPool({
        host                : '[YOUR HOST]',
        user                : '[USER NAME]',
        password            : '[PASSWORD]',
        database            : '[DATABASE]',
        charset             : 'utf8',
        waitForConnections  : true,
        connectionLimit     : 40
    });
log.out.w(TAG, "LocalHost", "Create Connection Pool");

module.exports = {
    dbQuery : function(queryString, errReturn, callback){
        getConnection(function(connection){
            if(connection == null)
                errReturn({"status": '500'});
            else{
                connection.query(queryString, function(err, rows, fields) {
                    connection.release();
                    if(err){
                        log.out.e(TAG, "LocalHost", "SQL Query Error : " + err);
                        errReturn({"status": '500'});
                    }
                    else if(callback != undefined)
                        callback(rows);
                });
            }
        });
    }
};

function getConnection(callback){
    pool.getConnection(function(err, connection){
        if(err){
            log.out.e(TAG, "LocalHost", "Get Connection error");
            callback(null);
        }
        else{
            callback(connection);
        }
    });
}
