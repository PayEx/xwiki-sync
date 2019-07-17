const http = require("http"),
    fs = require('fs'),
    path = require('path'),
    util = require('util');
    exec = util.promisify(require('child_process').exec);

// Crash on unhandled promise rejection
// https://medium.com/@dtinth/making-unhandled-promise-rejections-crash-the-node-js-process-ffc27cfcc9dd
process.on('unhandledRejection', up => { throw up });

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

run();

async function run (){
    const xWikiHttpService = createXwikiHttpService(configuration.url, configuration.user, configuration.password);

    let lastedSyncedCommitId;

    try {
        console.log("Getting lastest Sync");
        lastedSyncedCommitId = await xWikiHttpService.getLatestSync("sync-log");
    } catch(err){
        // TODO: Custom Error?
        if(err.message === "Status code: 404"){
            console.log("Creating Sync Log Docment");
            await xWikiHttpService.createSyncLogDocument();
        } else {
            throw err;
        }
    }

    console.log("LastedSyncedCommitId: ");
    console.log(lastedSyncedCommitId);

    const changedDocments = await getChangedFiles(lastedSyncedCommitId);

    console.log("Changed documents");
    console.log(changedDocments);

    
}

async function syncDocuments(documents){
    
}

// TODO: Abstract to git service
async function getChangedFiles(commitId){
    if(!commitId){
        // https://stackoverflow.com/questions/40883798/how-to-get-git-diff-of-the-first-commit
        // "4b825dc642cb6eb9a060e54bf8d69288fbee4904 is the id of the "empty tree" in Git and it's always available in every repository."
        commitId = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
    }

    const { stdout, stderr } = await exec("git diff --name-only " + commitId + " HEAD ./test-documents/");

    if(stderr){
        console.log('stdout:', stdout);
        throw new Error("Crashed running diff, please review stdout above");
    }

    const filePaths = stdout.split(/\n/);
    filePaths.pop();
    
    let readFilePromises = [];
    filePaths.forEach((filePath) => {
        let readFilePromise = new Promise(function(resolve, reject) {
            fs.readFile(filePath, { encoding: 'utf-8' }, function (error, data){
                if(error){
                    return reject(error);
                }

                resolve({ 
                    path: filePath, 
                    content: data 
                });
            });
        });

        readFilePromises.push(readFilePromise);
    });

    const changedFiles = await Promise.all(readFilePromises);

    return changedFiles;
};


function createXwikiHttpService (space, user, password){
    return {
        getLatestSync: getLatestSync,
        createSyncLogDocument, createSyncLogDocument
    }

    async function getLatestSync(){
        const syncLogDocument = await httpRequest("GET", "sync-log");
        
        // TODO: Filter out ID
        const lastedSyncedCommitId = syncLogDocument.content;

        return lastedSyncedCommitId;
    }



    async function createSyncLogDocument() {
        var requestData = JSON.stringify({
            title: "Sync Document",
            syntax: "markdown/1.2",
            content: "" 
        });

        const syncLogDocument = await httpRequest("PUT", "sync-log", requestData);

        return syncLogDocument;
    }

    // Based on https://stackoverflow.com/questions/38533580/nodejs-how-to-promisify-http-request-reject-got-called-two-times#answer-38543075
    function httpRequest(method, page, postData) {
        const auth = Buffer.from(user + ":" + password).toString("base64");

        return new Promise(function(resolve, reject) {
            var request = http.request({
                hostname: space.hostname,
                port: space.port,
                path: space.pathname + page,
                method: method,
                headers: {
                    "Authorization": "Basic " +  auth,
                    "Content-Type": "application/json",
                    "Allow": "application/json",
                    "Accept": "application/json"
                }
            }, function(response) {
                // cumulate data
                var body = [];
                response.on('data', function(chunk) {
                    body.push(chunk);
                });
                
                // resolve on end
                response.on('end', function() {
                    try {
                        body = Buffer.concat(body).toString();
                    } catch(e) {
                        reject(e);
                    }

                    if (response.statusCode < 200 || response.statusCode >= 300) {
                        console.log("Bad status: ");
                        console.log(body);
                        return reject(new Error('Status code: ' + response.statusCode));
                    }

                    const parsedBody = JSON.parse(body);
                    resolve(parsedBody);
                });
            });
            // reject on request error
            request.on('error', function(err) {
                // This is not a "Second reject", just a different sort of failure
                reject(err);
            });

            if (postData) {
                request.write(postData);
            }
            // IMPORTANT
            request.end();
        });
    }
}



// var fileName = "foo",
//     fileExtension = "md",
//     wikiTitle = "foo-test-19",
//     filePath = path.join(__dirname, fileName + "." + fileExtension);

// fs.readFile(filePath, { encoding: 'utf-8' }, function (error, data){
//     var postRequest = http.request({
//         hostname: configuration.url.hostname,
//         port: configuration.url.port,
//         path: configuration.url.pathname + wikiTitle,
//         method: "PUT",
//         headers: {
//             "Authorization": "Basic " +  auth,
//             "Content-Type": "application/json",
//             "Allow": "application/json"
//         }
//     }, (res) => {
//         res.setEncoding('utf8');
//         res.on('data', function (chunk) {
//             console.log('\n Response: ' + chunk);

//             console.log("\n Ok, I'm done. See you later alligator.");
//             console.log("------------------------------------------------------------");
//         });
//     });
    
//     var requestData = JSON.stringify({
//         title: wikiTitle,
//         creator: "TestTest",
//         syntax: "markdown/1.2",
//         content: data 
//     });

//     postRequest.write(requestData);

//     postRequest.end();
// });


