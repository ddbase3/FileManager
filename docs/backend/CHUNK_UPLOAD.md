# Chunk Upload Protocol

Chunking is the normal upload protocol, including for small files.

A small file is simply one chunk.

## Goals

- support very large files
- avoid complete-file buffering in browser memory
- support upload progress
- retry only failed chunks
- cancel active requests
- keep a stable server-side upload session
- prepare resume without introducing a second upload architecture

## Start

The browser calls `startUpload()` before sending file data.

The request includes file metadata, destination path, chunk size and total chunk count.

The server creates or resumes one temporary upload session and returns a stable `uploadId` plus already completed chunk indexes.

## Chunk transfer

For each missing chunk the browser uses:

```javascript
file.slice(offset, end)
```

Only the slice for that request is transferred.

Chunks may be uploaded in parallel. The server must therefore identify them by upload ID and chunk index, not by arrival order.

A chunk write should be idempotent for the same upload ID and index. Re-sending a completed chunk must not corrupt the temporary upload.

## Retry

A chunk failure is retried up to `retryLimit`.

Other completed chunks are not resent.

If the whole file task enters the failed state and the user chooses Retry, the task keeps its previous `uploadId`. `startUpload()` can then return the existing session and its completed chunk indexes.

## Progress

The HTTP adapter reports upload progress from `XMLHttpRequest.upload`.

The core sums progress across active and completed chunks and exposes file progress between 0 and 1.

## Finish

When every chunk is complete, the browser calls:

```text
finishUpload(uploadId)
```

The server validates the session, assembles or promotes the temporary upload into final storage and returns the final file descriptor.

Only then does the browser add the file to a single or collection value.

## Cancel

Cancellation has two parts:

1. abort active browser requests through `AbortController`
2. call `abortUpload(uploadId)` so the backend can delete temporary state

## Cleanup

The backend should also clean stale upload sessions independently, because a browser can disappear without sending an abort request.

This cleanup belongs to backend operational logic, not to the ES module.
