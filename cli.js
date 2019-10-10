#!/usr/bin/env node

const http = require("http"),
    fs = require('fs'),
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

    console.log("Lasted synced commit ID: ");
    console.log(lastedSyncedCommitId);

    const changedDocments = await getChangedFiles(lastedSyncedCommitId, configuration.source);

    console.log("Changed documents: ");
    console.log(changedDocments);

    await xWikiHttpService.syncDocuments(changedDocments);

    var headId = await getHead();

    //await xWikiHttpService.updateSyncLogDocument(headId);
}

// TODO: Abstract to git service
async function getChangedFiles(commitId, source){
    if(!commitId){
        // https://stackoverflow.com/questions/40883798/how-to-get-git-diff-of-the-first-commit
        // "4b825dc642cb6eb9a060e54bf8d69288fbee4904 is the id of the "empty tree" in Git and it's always available in every repository."
        commitId = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
    }

    let gitDiff = await exec("git diff --name-only --diff-filter=AM " + commitId + " HEAD " + source);

    if(gitDiff.stderr){
        console.log('stdout:', gitDiff.stdout);
        throw new Error("Crashed running diff, please review stdout above");
    }

    const filePaths = gitDiff.stdout.split(/\n/);
    filePaths.pop();
    
    let readFilePromises = [];
    filePaths.forEach((filePath) => {
        let readFilePromise = new Promise(function(resolve, reject) {
            fs.readFile(filePath, function (error, data){
                if(error){
                    return reject(error);
                }

                // TODO: Will this work with different types of path input such as "./"?
                // TODO: Is this really the right place to do this replace anyways?
                let replaceRegex = new RegExp("^" + source);


                resolve({ 
                    path: filePath.replace(replaceRegex, ""),
                    content: /.md$/.test(filePath) ? data.toString("utf-8") : data
                });
            });
        });

        readFilePromises.push(readFilePromise);
    });

    const changedFiles = await Promise.all(readFilePromises);

    return changedFiles;
};

async function getHead(){
    // TODO: Error handling? 
    const commandResult = await exec("git rev-parse HEAD");
    return commandResult.stdout.split(/\n/)[0];
}


function createXwikiHttpService (space, user, password){
    return {
        getLatestSync: getLatestSync,
        createSyncLogDocument: createSyncLogDocument,
        syncDocuments: syncDocuments,
        updateSyncLogDocument: updateSyncLogDocument
    }

    async function getLatestSync(){
        const syncLogDocument = await httpRequest("GET", "spaces/sync-log/pages/WebHome");
        const lastedSyncedCommitId = syncLogDocument.content;
        return lastedSyncedCommitId;
    }

    async function syncDocuments (documents){
        const pages = documents.filter((document) => { return /.md$/.test(document.path); });
        const attachments = documents.filter((document) => { return /.png/.test(document.path); });

        await throttle(pages, (document) => {
            return syncDocument(document);
        }, 5);

        return throttle(attachments, (attachment) => {
            return syncAttachment(attachment);
        }, 5);
    }

    async function syncDocument(document){
        // TODO: Could this be solved better with regex?
        let wikiTitle;
        let contentArray = document.content.split("\n");
        let firstLine = contentArray[0];

        if(firstLine.match(/^#\s/)){
            wikiTitle = firstLine.replace("# ", "");
            contentArray.shift();
            document.content = contentArray.join("\n");
        } else {
            // TODO: Redudans
            let pathWithoutFileExtention = document.path.replace(/(.md|.png)$/, "");
            let pathSplit = pathWithoutFileExtention.split("/");
            wikiTitle = pathSplit[pathSplit.length - 1] === "index" ? pathSplit[pathSplit.length - 2] : pathSplit[pathSplit.length - 1];
        }

        // TODO: What about external links without http in their urls
        const contentAsXwikiMarkdown = document.content.replace(/!?\[(.*?)\]\(((?!http)\S*)\)/g, function(match, label, url){

            if(match.startsWith("!")){
                return `![[${label}|${url}]]`;
            } else {
                const pageName = getPageName(url);
                return `[[${label}|${pageName}]]`;
            }
        });

        let requestData = JSON.stringify({
            title: wikiTitle,
            syntax: "markdown/1.2",
            content: contentAsXwikiMarkdown
        });
        
        const path = getWikiSpacePath(document.path) + "pages/WebHome";

        return httpRequest("PUT", path, requestData);
    }

    async function syncAttachment(attachment){
        const space = getWikiSpacePath(attachment.path);
        const attachmentName = /[\w-]*\.png$/.exec(attachment.path);
        const path =  space +  "pages/WebHome/attachments/" + attachmentName;

        return httpRequest("PUT", path, attachment.content, "image/png");
    }

    async function createSyncLogDocument() {
        var requestData = JSON.stringify({
            title: "Sync Document",
            syntax: "markdown/1.2",
            content: ""
        });

        const syncLogDocument = await httpRequest("PUT", "spaces/sync-log/pages/WebHome", requestData);

        return syncLogDocument;
    }

    async function updateSyncLogDocument(commitId){
        // TODO: Should this be a terminal page?
        // TODO: Should earlier commits be saved?
        // TODO: Should the page contain more info then just the commit id?
        // TODO: If no, then their is no need for this and createSyncLogDocument()
        var requestData = JSON.stringify({
            title: "Sync Document",
            syntax: "markdown/1.2",
            content: commitId
        });

        return httpRequest("PUT", "spaces/sync-log/pages/WebHome", requestData);
    }

    // Based on https://stackoverflow.com/questions/38533580/nodejs-how-to-promisify-http-request-reject-got-called-two-times#answer-38543075
    function httpRequest(method, page, postData, contentType) {

        console.log("Outgoing request: ");
        console.log(method + ": " + space.pathname + page);

        const auth = Buffer.from(user + ":" + password).toString("base64");

        return new Promise(function(resolve, reject) {
            var request = http.request({
                hostname: space.hostname,
                port: space.port,
                path: encodeURI(space.pathname + page),
                method: method,
                headers: {
                    "Authorization": "Basic " +  auth,
                    "Content-Type": contentType ? contentType : "application/json",
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
                        console.log("Questionable request (status code: " + response.statusCode + "): ", space.pathname + page);
                        return reject(new Error('Status code: ' + response.statusCode));
                    }

                    const parsedBody = JSON.parse(body);

                    console.log("Request finished: ");
                    console.log(method + ": " + space.pathname + page);

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

    function getWikiSpacePath(filepath){
        let pathWithoutFileExtention = filepath.replace(/(.md|.png)$/, "");
        let pathSplit = pathWithoutFileExtention.split("/");
        let lastIndex = pathSplit.length - 1;

        let wikiPath = "";

        pathSplit.forEach((fragment, key) => {
            let isLastFragment = key === lastIndex;

            if(isLastFragment && (fragment === "index" || /.png$/.test(filepath))){
                return;
            }

            wikiPath += "spaces/" + fragment + "/";
        });

        return wikiPath;
    }

    function getPageName(url){
        // TODO: This seems to be some of the same logic as the get space function
        const urlWithoutLeadingSlash = url.replace(/^\//, "");
        const urlWithoutExtention = urlWithoutLeadingSlash.replace(/\.md$/, "");
        const urlWithoutIndex = urlWithoutExtention.replace(/\/index$/, "");
        return urlWithoutIndex.replace(space, "").replace(/\//g, ".");
    }

    function throttle(list, action, limit){
        let i = limit;
        const proxyPromises = [];
        const resolvables = []
        list.forEach((item) => {
            const proxyPromise = new Promise((resolve) => {
                resolvables.push({
                    item,
                    resolve
                });
            });

            proxyPromises.push(proxyPromise);
        });

        resolvables.slice(0,i).forEach((resolvable) => {
            run(resolvable);
        });

        function run(resolvable){    
            action(resolvable.item).then(() => {
                if(i < list.length){
                    run(resolvables[i]);
                    i++;
                }

                resolvable.resolve();
            });
        }

        return Promise.all(proxyPromises);
    }
}