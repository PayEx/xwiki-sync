var http = require("http"),
    fs = require('fs'),
    path = require('path');

var auth = Buffer.from("Admin:admin").toString("base64"),
    fileName = "foo",
    fileExtension = "md",
    wikiTitle = "foo-test-two",
    filePath = path.join(__dirname, fileName + "." + fileExtension);

fs.readFile(filePath, { encoding: 'utf-8' }, function (error, data){
    var postRequest = http.request({
        hostname: "localhost",
        port: 8080,
        path: "/xwiki/rest/wikis/xwiki/spaces/Sandbox/pages/" + wikiTitle,
        method: "PUT",
        headers: {
            "Authorization": "Basic " +  auth,
            "Content-Type": "application/json",
            "Allow": "application/json"
        }
    }, (res) => {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            console.log('Response: ' + chunk);
        });
    });
    
    var requestData = JSON.stringify({
        title: wikiTitle,
        syntax: "markdown/1.2",
        content: data 
    });

    postRequest.write(requestData);

    postRequest.end();
});

