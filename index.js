// var Git = require("nodegit");

const http = require("http"),
    fs = require('fs'),
    path = require('path'),
    util = require('util');
    exec = util.promisify(require('child_process').exec);

const configuration = {
    user: null,
    password: null,
    source: null,
    url: null
};

console.log("\n Let's sync some documents...");
console.log("------------------------------------------------------------");

process.argv.forEach(function(argument, index){
    // Node path and script name is included in argv
    if(index <= 1){ return; }

    var argumentMatch = argument.match(/--([a-z]+)=(\S+)/);

    if(argumentMatch === null){
        throw new Error("Invalid argument " + argument);
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
        case "source":
            configuration.source = argumentValue;
            break;
        case "wiki":
            configuration.url = new URL(argumentValue)
            break;
        default:
            throw new Error("Unrecognized argument " + argumentName + " with value " + argumentValue);
    }
});

if(configuration.user === null){
    throw new Error("Missing confiugration for user");
}

if(configuration.password === null){
    throw new Error("Missing confiugration for password");
}

if(configuration.url === null){
    throw new Error("Missing confiugration for url");
}

if(configuration.source === null){
    throw new Error("Missing confiugration for source");
}

console.log("Configuration: ");
console.log(configuration);

var auth = Buffer.from(configuration.user + ":" + configuration.password).toString("base64");

// console.log(configuration.url.pathname + "sync-log/");

// const logRequest = http.request({
//     hostname: configuration.url.hostname,
//     port: configuration.url.port,
//     path: configuration.url.pathname + "sync-log/",
//     method: "GET",
//     headers: {
//         "Authorization": "Basic " +  auth,
//         "Content-Type": "application/json",
//         "Allow": "application/json"
//     }
// }, (res) => {
//     res.setEncoding('utf8');
//     res.on('data', function (chunk) {
//         console.log('\n Response: ' + chunk);
//     });
// });

// logRequest.end();

async function getChangedFiles(){
    const { stdout, stderr } = await exec("git diff --name-only ca63a7b 119d757 ./test-documents/");

    if(stderr){
        console.log('stdout:', stdout);
        throw new Error("Crashed running diff, please review stdout above");
    } 

    const stdoutSplit = stdout.split(/\n/);
    stdoutSplit.pop();

    return stdoutSplit;
}

getChangedFiles().then(function(value){
    console.log("Hello ");
    console.log(value);
});


var fileName = "foo",
    fileExtension = "md",
    wikiTitle = "foo-test-19",
    filePath = path.join(__dirname, fileName + "." + fileExtension);

fs.readFile(filePath, { encoding: 'utf-8' }, function (error, data){
    var postRequest = http.request({
        hostname: configuration.url.hostname,
        port: configuration.url.port,
        path: configuration.url.pathname + wikiTitle,
        method: "PUT",
        headers: {
            "Authorization": "Basic " +  auth,
            "Content-Type": "application/json",
            "Allow": "application/json"
        }
    }, (res) => {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            console.log('\n Response: ' + chunk);

            console.log("\n Ok, I'm done. See you later alligator.");
            console.log("------------------------------------------------------------");
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


