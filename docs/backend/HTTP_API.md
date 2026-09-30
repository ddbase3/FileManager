# HTTP Backend API

`HttpFileManagerAdapter` uses one base URL and operation endpoints below it.

Default endpoint names are configurable.

## Default endpoints

```text
POST list
POST stat
POST mkdir
POST delete
POST rmdir
POST copy
POST move
POST upload/start
POST upload/chunk
POST upload/status
POST upload/finish
POST upload/abort
GET  download?path=...
```

All non-chunk POST endpoints use JSON request bodies and JSON response bodies.

`upload/chunk` uses multipart form data so the chunk is transferred as binary content.

## Errors

Use a non-2xx HTTP status for failure.

A JSON error response may contain:

```json
{
	"message": "Human readable error"
}
```

The adapter exposes that message to the FileManager upload or operation state.

## `list`

Request:

```json
{
	"path": "documents"
}
```

Response:

```json
{
	"containerId": "container_123",
	"path": "documents",
	"items": []
}
```

## `stat`

Request:

```json
{
	"path": "documents/report.pdf"
}
```

Response: one file descriptor.

## `mkdir`

Request:

```json
{
	"path": "documents/new-folder"
}
```

Response: the new directory descriptor.

## `delete` and `rmdir`

Request:

```json
{
	"path": "documents/report.pdf"
}
```

or:

```json
{
	"path": "documents/old-folder"
}
```

A successful response may be:

```json
{
	"success": true
}
```

## `copy`

Request:

```json
{
	"sourcePath": "documents/report.pdf",
	"targetPath": "archive/report.pdf"
}
```

The operation is expected to use the backend storage's native copy capability.

## `move`

Request:

```json
{
	"sourcePath": "documents/report.pdf",
	"targetPath": "archive/report.pdf"
}
```

Rename is the same operation with a new target name in the same parent directory.

## Authentication and CSRF

The adapter accepts custom headers and a Fetch credentials mode:

```javascript
new HttpFileManagerAdapter({
	baseUrl: '/api/files',
	credentials: 'same-origin',
	headers: {
		'X-CSRF-Token': token
	}
});
```

The same headers are applied to chunk requests.
