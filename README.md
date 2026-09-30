# FileManager

FileManager is a standalone Vanilla JavaScript ES module for file selection, uploads and complete file container management.

It is designed to replace Dropzone use cases while also serving as a reusable form control and a standalone file management UI.

## Core capabilities

- drag and drop uploads
- normal file picker button
- upload queue
- configurable parallel file uploads
- chunked uploads for large files
- configurable parallel chunk uploads
- per-chunk retry
- upload cancellation
- progress per file
- file type validation
- file size validation
- file count limits
- single file mode
- collection mode
- container mode
- optional form binding
- standalone operation without a form
- folder navigation
- directory creation
- native backend copy and move operations
- rename through move
- file and directory deletion
- download links
- event bus
- command registry
- plugin manager
- adapter boundary for backend integration
- no runtime dependencies
- no build step

## Source and deployment

The repository source lives under:

```text
ClientStack/dev/FileManager/src/
```

ClientStack deploys that source unchanged to:

```text
ClientStack/assets/filemanager/
```

The source directory is authoritative. Do not edit the deployed asset copy separately.

## Single file

```javascript
import {
	FileManager,
	HttpFileManagerAdapter
} from './src/index.js';

const adapter = new HttpFileManagerAdapter({
	baseUrl: '/api/files'
});

const manager = new FileManager('#avatar', {
	mode: 'single',
	adapter,
	upload: {
		chunkSize: 8 * 1024 * 1024
	}
});

manager.init();
```

## Collection

```javascript
const manager = new FileManager('#attachments', {
	mode: 'collection',
	adapter,
	upload: {
		accept: '.pdf,image/*',
		maxFiles: 20,
		maxFileSize: 2 * 1024 * 1024 * 1024,
		chunkSize: 8 * 1024 * 1024,
		maxParallelFiles: 3,
		maxParallelChunks: 2,
		retryLimit: 3
	}
});

manager.init();
```

## Form binding

The same manager can participate in a normal form that contains arbitrary other fields.

```html
<form id="article-form">
	<input name="title">
	<textarea name="description"></textarea>
	<div id="attachments"></div>
	<button type="submit">Save</button>
</form>
```

```javascript
const manager = new FileManager('#attachments', {
	mode: 'collection',
	adapter,
	form: {
		name: 'attachments'
	}
});

manager.init();
```

The manager adds one hidden field named `attachments`. Collection values are serialized as a JSON array of stable file IDs. Other form controls are not modified.

If the form is submitted while uploads are active, submission is delayed until the same upload queue is idle. Failed uploads keep the submission blocked so the user can retry or remove them.

## Container

```javascript
const manager = new FileManager('#files', {
	mode: 'container',
	adapter,
	rootPath: 'project-files'
});

manager.init();
await manager.ready;
```

Container mode adds browsing, selection, folder creation, rename, copy, move and delete actions. `copy()` and `move()` are backend adapter operations. With BASE3 file storage they map directly to `IFileStorage::copy()` and `IFileStorage::move()` for files. FileManager does not emulate these operations with browser-side read and write calls.

## Chunk uploads

All modes use the same upload path:

```text
File selection or drop
  -> validation
  -> UploadQueue
  -> ChunkUploader
  -> adapter.startUpload()
  -> adapter.uploadChunk()
  -> adapter.finishUpload()
  -> file descriptor
```

The browser slices files with `File.slice()`. It does not buffer a complete large file in JavaScript memory.

An upload session has a stable `uploadId`. A retry reuses the same session when the backend still provides it. The backend can return already uploaded chunk indexes from `startUpload()` so completed chunks are not sent again.

## File descriptor

Backend operations return normalized file descriptors:

```javascript
{
	id: 'file_123',
	name: 'report.pdf',
	path: 'documents/report.pdf',
	kind: 'file',
	size: 3842190,
	mimeType: 'application/pdf',
	modifiedAt: '2026-09-30T10:30:00Z'
}
```

Directories use `kind: 'directory'`.

`id`, `name`, `path` and `kind` are required. Stable IDs are used for single and collection form values.

## Events

Important events include:

- `file:added`
- `file:rejected`
- `upload:queued`
- `upload:started`
- `upload:progress`
- `upload:retry`
- `upload:completed`
- `upload:failed`
- `upload:cancelled`
- `queue:change`
- `queue:idle`
- `value:change`
- `directory:change`
- `selection:change`
- `form:submit-blocked`

```javascript
manager.on('upload:progress', ({ task, progress }) => {
	console.log(task.file.name, progress);
});
```

## Commands

The core registers these commands:

- `addFiles`
- `cancelUpload`
- `retryUpload`
- `removeUpload`
- `removeItem`
- `refresh`
- `navigate`
- `mkdir`
- `rename`
- `copy`
- `move`
- `delete`
- `select`
- `clearSelection`

## Demos

Serve the repository with any static web server:

```bash
python3 -m http.server 8000
```

Then open:

- `http://localhost:8000/demos/single/`
- `http://localhost:8000/demos/collection/`
- `http://localhost:8000/demos/container/`
- `http://localhost:8000/demos/form-collection/`
- `http://localhost:8000/demos/chunked-upload/`
- `http://localhost:8000/tests/browser-smoke/`

## Tests

```bash
npm run check
npm run smoke
```

See `docs/` for the core contract, adapter protocol, form binding and BASE3 backend guidance.
