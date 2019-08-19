# XWiki Sync (Work in progress)
Sync service, from disk to XWiki.

## Usage
Local test usage with default credentials

`node index.js --user=Admin --password=admin --wiki=http://localhost:8080/xwiki/rest/wikis/xwiki/spaces/Sandbox/pages/ --source=test-documents`

`node index.js --user=Admin --password=admin --wiki=http://localhost:8080/xwiki/rest/wikis/xwiki/spaces/myroot/ --source=test-documents/`

`./cli.js --user=Admin --password=admin --wiki=http://localhost:8080/xwiki/rest/wikis/xwiki/spaces/myroot/ --source=test-documents/`

`git rev-parse b5169af`

`git diff --name-only b5169af0d30c887299093951e09f6e0896525b4e`

## Todos
- [x] Create NPM Package
- [x] Use NPM Package in doc repo
- [x] Read files from repo
- [ ] Change detection (What should be posted to XWiki)
- [ ] Use in TC Build
- [ ] Modification flow (lock it down)
- [ ] Author (Might not work)
- [ ] Attachments
- [ ] Macro test
