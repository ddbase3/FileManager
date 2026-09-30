# FileManager Core Contract

## Purpose

The FileManager core coordinates one browser-side manager instance.

It owns:

- instance options
- mode selection
- local state
- events
- commands
- plugins
- upload queue
- rendering
- backend adapter access
- optional form binding setup

It does not own server storage semantics.

## Instance model

Each `FileManager` instance is independent.

Multiple managers may exist on one page with different modes, adapters, roots and form bindings.

No instance state is stored globally.

## Modes

The supported modes are:

### `single`

Represents zero or one stable file ID.

A successful new upload replaces the previous field value. The previous backend file is not deleted automatically unless the host explicitly configures `deleteOnRemove` and removes it.

### `collection`

Represents an ordered array of stable file IDs.

Uploaded file descriptors are appended in completion order.

### `container`

Represents one backend container or root path and exposes file management operations inside it.

The form value is the backend `containerId` when available, otherwise the configured root path.

## Shared upload path

Every mode calls the same `UploadQueue` and `ChunkUploader`.

```text
FileManager.addFiles()
  -> validation
  -> UploadQueue.add()
  -> ChunkUploader.upload()
  -> adapter.startUpload()
  -> adapter.uploadChunk()
  -> adapter.finishUpload()
```

There is no special small-file upload path.

A file smaller than the chunk size simply consists of one chunk.

## File descriptors

A backend file descriptor requires:

```javascript
{
	id,
	name,
	path,
	kind
}
```

Optional standard fields are:

```javascript
{
	size,
	mimeType,
	modifiedAt,
	metadata
}
```

`kind` must be `file` or `directory`.

The browser does not invent stable IDs. They come from the backend.

## State

Core state includes:

```javascript
{
	items,
	entries,
	selectedPaths,
	rootPath,
	currentPath,
	containerId,
	loading,
	error
}
```

Upload task state belongs to `UploadQueue`, not to the file list or DOM.

## Lifecycle

```javascript
const manager = new FileManager(target, options);
manager.init();
manager.destroy();
```

Container mode exposes `manager.ready`, which resolves after the first directory listing is loaded.

## Public state access

Use:

- `getValue()` for the mode value
- `getItems()` for single or collection descriptors
- `getState()` for instance state
- `setItems()` to hydrate single or collection descriptors
- `hasPendingUploads()` for queue status
- `waitForUploads()` to wait for a clean queue

The DOM is not the source of truth.
