# Working Rules

## Source ownership

`src/` is the only editable implementation source.

ClientStack deploys `src/` unchanged to `assets/filemanager/`. Do not make independent fixes in the deployed asset copy.

## Core architecture

Keep one FileManager core and one upload path.

Do not create separate implementations for:

- standalone use
- form use
- single mode
- collection mode
- container mode
- small uploads
- large uploads

Mode-specific behavior belongs in the mode contract and rendering behavior. Upload mechanics remain shared.

## Backend boundary

The browser depends on the FileManager adapter contract.

Do not make the ES module depend on BASE3, PHP, `IFileStorage`, ILIAS or one specific storage backend.

Native backend capabilities such as copy and move remain adapter operations. Do not emulate missing backend capabilities in the browser.

## Form behavior

The manager owns only its configured form field.

It must not rename, remove, replace or serialize unrelated form controls.

If upload work is active at submit time, the form binding waits for the same upload queue before allowing submission to continue.

## Upload behavior

Large files are sliced with `File.slice()`.

Do not load a complete large file into browser memory.

Chunk retry must retry only the failed chunk. A failed file upload keeps its upload session ID so retry can continue the same server-side session.

Cancellation aborts active browser requests and tells the backend to abort the upload session.

## Compatibility direction

Dropzone is a migration source, not an architectural dependency.

Add required Dropzone replacement capabilities directly to FileManager when they are generally useful. Do not add a Dropzone-shaped compatibility layer to the core.
