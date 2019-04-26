var http = require("http"),
    fs = require('fs'),
    path = require('path');

let configuration = {
    user: null,
    password: null,
    url: null
};

process.argv.forEach(function(argument, index){
    // Node path and script name is included in argv
    if(index >= 2){ return; }

    console.log(argument);

    var argumentMatch = argument.match(/--([a-z]+)=(\S+)/);

    console.log(argumentMatch);

    if(argumentMatch === null){
        new Error("Invalid argument " + argument);
    }

    var argumentName = argumentMatch[1];
    var argumentValue = argumentMatch[2];
    
    switch (argumentName){
        case "user":
            configuration.user = argumentValue;
            break;
        case "password":
            configuration.password = argumentValue;
            break;
        case "wiki":
            configuration.url = new URL(argumentValue)
            break;
        default:
            new Error("Unrecognized argument " + argumentName + " with value " + argumentValue);
    }
});

if(configuration.user === null){
    new Error("Missing confiugration for user");
}

if(configuration.password === null){
    new Error("Missing confiugration for password");
}

if(configuration.url === null){
    new Error("Missing confiugration for url");
}

console.log("Configuration");
console.log(configuration);

var auth = Buffer.from(configuration.user + ":" + configuration.password).toString("base64"),
    fileName = "foo",
    fileExtension = "md",
    wikiTitle = "foo-test-18",
    filePath = path.join(__dirname, fileName + "." + fileExtension);

fs.readFile(filePath, { encoding: 'utf-8' }, function (error, data){
    var postRequest = http.request({
        hostname: configuration.url.hostname,
        port: configuration.url.port,
        path: configuration.url.pathName + wikiTitle,
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
        creator: "TestTest",
        syntax: "markdown/1.2",
        content: data 
    });

    postRequest.write(requestData);

    postRequest.end();
});

