# NTUChorus Seating Chart Server

This project is the server code of [NTUChorus github](http://ntuchorus.github.io). The program is running with `nodejs`, which needed packages are described in `package.json`.

## Table of Contents

* [Installation](#Installation)
* [Configuration](#Configutation)
* [Running]
* [Architecture]
* [Database Structure]
* [Authors]
* [License]

## Installation

1. Clone this repository.

```
$ git clone https://github.com/q82419/ntuchorus-server.git
```

2. Prepare NodeJS packages

   Use `npm` to install the needed packages described in `package.json`.

   ```bash
   $ cd ./your-working-directory/
   $ npm install
   ```

## Configuration

1. Configure the Facebook application id and secret for member systems.
   - Open the file.
     ```bash
     $ vim login.js
     ```
   - Edit the appId and appSecret.
     ```javascript
     fb.options({version: 'v2.8', appId: '[FACEBOOK_APP_ID]', appSecret: 'FACEBOK_APP_SECRET'});
     ```

2. Configure the mysql database locations
   - Open the file.
     ```bash
     $ vim db.js
     ```
   - Edit the host, username, and password.
     ```javascript
     var pool = mysql.createPool({
         host                : '[YOUR_HOST]',
         user                : '[USER_NAME]',
         password            : '[PASSWORD]',
         database            : '[DATABASE]',
         charset             : 'utf8',
         waitForConnections  : true,
         connectionLimit     : 40
     });
     ```
