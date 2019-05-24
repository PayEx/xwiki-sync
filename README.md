# XWiki Sync (Work in progress)
Sync service, from disk to XWiki.

## Usage
Local test usage with default credentials

`node index.js --user=Admin --password=admin --wiki=http://localhost:8080/xwiki/rest/wikis/xwiki/spaces/Sandbox/pages/`

## Todos
- [ ] Create NPM Package
- [ ] Use NPM Package in doc repo
- [ ] Read files from repo
- [ ] Change detection (What should be posted to XWiki)
- [ ] Use in TC Build
- [ ] Modification flow (lock it down)
- [ ] Author (Might not work)
- [ ] Attachments
- [ ] Macro test
