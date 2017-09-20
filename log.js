var dateFormat = require('dateformat');
var util = require('util');
var fs = require('fs');
var log_file = fs.createWriteStream(__dirname + '/debug.log', {flags : 'a'});

// Color Table
var cTag = {
        "time"  : '\x1b[38;5;229m',
        "ip"    : '\x1b[38;5;221m',
        "reset" : '\x1b[0m',
        "[   SYSTEM   ]" : '\x1b[38;5;85m',
        "[ SYS--MYSQL ]" : '\x1b[38;5;219m',
        "[ CHECK   FB ]" : '\x1b[38;5;202m',
        "[ CRE  ADMIN ]" : '\x1b[38;5;184m',
        "[ DEL  ADMIN ]" : '\x1b[38;5;27m',
        "[ UPD  MANAG ]" : '\x1b[38;5;135m',
        "[ UPD  ADMIN ]" : '\x1b[38;5;111m',
        "[ REQ  GUEST ]" : '\x1b[38;5;119m',
        "[ REQ  MANAG ]" : '\x1b[38;5;119m',
        "[ REQ  ADMIN ]" : '\x1b[38;5;201m'
    };
var cMsg = {
        "e" : '\x1b[38;5;197m',
        "w" : '\x1b[38;5;208m',
        "i" : '\x1b[0m'
    };

exports.out = {
    // Log Error
    e: function(TAG, ip, msg){
        printLog(TAG, ip, msg, cTag[TAG], cMsg["e"]);
    },
    // Log Warning
    w: function(TAG, ip, msg){
        printLog(TAG, ip, msg, cTag[TAG], cMsg["w"]);
    },
    // Log Information
    i: function(TAG, ip, msg){
        printLog(TAG, ip, msg, cTag[TAG], cMsg["i"]);
    }
};

function printLog(TAG, ip, msg, TAGcolor, msgcolor){
    var now = new Date();
    var str = dateFormat(now, "yyyy-mm-dd HH:MM:ss");
    var colorStr = cTag['time'] + str + ' ' + cTag['ip'] + '[' + ("                      " + ip).slice(-22) + ']' + TAGcolor + TAG + ' ' + msgcolor + msg + cTag['reset'];
    str += ' [' + ("                      " + ip).slice(-22) + ']' + TAG + ' ' + msg;
    console.log(colorStr);
    log_file.write(util.format(str) + '\n');
};

