# FileManager Adapter Contract

The adapter is the only backend boundary used by FileManager.

The ES module does not know whether the backend is BASE3, another PHP application, Node.js, object storage or a test double.

## Required operations

The adapter contract contains:

```javascript
list(path)
stat(path)
mkdir(path)
delete(path)
rmdir(path)
copy(sourcePath, targetPath)
move(sourcePath, targetPath)
startUpload(upload, options = {})
uploadChunk(chunk)
getUploadStatus(uploadId)
finishUpload(uploadId, options = {})
abortUpload(uploadId)
getDownloadUrl(path)
```

## Native copy and move

`copy()` and `move()` are backend capabilities.

The FileManager core does not implement them using other adapter methods. This is important for large files and remote storage backends where server-side copy and move operations are much more efficient than transferring file content through the browser.

For BASE3, file copy and move map directly to the current `IFileStorage::copy()` and `IFileStorage::move()` methods. Directory copy or move semantics, when enabled by a container backend, remain a backend-service concern.

## Directory listing

`list(path)` returns:

```javascript
{
	containerId: 'container_123',
	path: 'documents',
	items: [
		{
			id: 'file_1',
			name: 'report.pdf',
			path: 'documents/report.pdf',
			kind: 'file',
			size: 12345,
			mimeType: 'application/pdf',
			modifiedAt: '2026-09-30T10:30:00Z'
		}
	]
}
```

## Upload start

`startUpload()` receives:

```javascript
{
	uploadId: null,
	path: 'documents',
	name: 'video.mp4',
	size: 5368709120,
	type: 'video/mp4',
	lastModified: 1790755200000,
	chunkSize: 8388608,
	totalChunks: 640
}
```

For a retry, `uploadId` may contain the previous server session ID.

The response is:

```javascript
{
	uploadId: 'upload_abc123',
	uploadedChunks: [0, 1, 2]
}
```

Already uploaded chunks are skipped.

## Upload chunk

`uploadChunk()` receives a chunk object with:

- `uploadId`
- `index`
- `totalChunks`
- `offset`
- `size`
- `fileName`
- `blob`
- `signal`
- `onProgress(loaded, total)`

The HTTP adapter uses `XMLHttpRequest` for chunks because it exposes upload progress in browsers.

## Upload finalization

`finishUpload(uploadId, options)` returns the final file descriptor. The core passes the active upload abort signal and timeout through `options`, so cancellation also covers finalization.

The queue marks the file as complete only after this descriptor has been returned successfully.

## Cancellation

`abortUpload(uploadId)` removes or invalidates the server-side temporary upload session.
