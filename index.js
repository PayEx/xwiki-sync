var http = require("http"),
    fs = require('fs'),
    path = require('path');

var auth = Buffer.from("Admin:admin").toString("base64"),
    fileName = "foo",
    fileExtension = "xml",
    filePath = path.join(__dirname, fileName + "." + fileExtension);

fs.readFile(filePath, { encoding: 'utf-8' }, function (error, data){
    var postRequest = http.request({
        hostname: "localhost",
        port: 8080,
        path: "/xwiki/rest/wikis/xwiki/spaces/Sandbox/pages/" + fileName,
        method: "PUT",
        headers: {
            "Authorization": "Basic " +  auth,
            "Content-Type": "application/xml",
            "Allow": "application/json"
        }
    }, (res) => {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            console.log('Response: ' + chunk);
        });
    });
    
    postRequest.write(data);
    postRequest.end();
});

