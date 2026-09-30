# Current Status

FileManager 0.1.0 provides the first complete architecture and working implementation for the agreed scope.

## Implemented

- standalone ES module
- single file mode
- collection mode
- container mode
- drag and drop file input
- normal file picker button
- upload queue
- parallel file uploads
- chunked uploads
- parallel chunk uploads
- chunk retry
- upload cancellation
- progress reporting
- file type validation
- file size validation
- collection file count validation
- stable upload sessions through `uploadId`
- retry continuation through an existing `uploadId`
- optional form binding
- submit waiting while uploads are active
- hidden form values using stable file IDs
- folder navigation
- folder creation
- native copy calls
- native move calls
- rename through move
- file deletion
- directory deletion
- download URL support
- event bus
- command registry
- plugin manager
- HTTP adapter
- in-memory adapter for demos and tests
- browser demos
- browser smoke test
- node smoke test
- backend protocol documentation
- BASE3 `IFileStorage` integration guidance

## Important contract decisions

There is one upload implementation for all modes. Single, collection and container do not own separate upload paths.

Form binding is optional and external to the FileManager core. A manager without a form remains fully functional.

Copy and move are adapter operations. For BASE3 file operations they map directly to the current `IFileStorage::copy()` and `IFileStorage::move()` methods. They are not emulated through browser-side read, write and delete paths.

The backend returns stable file descriptors. Single and collection form values use descriptor IDs.

## Deliberately not implemented as a second path

- no Dropzone compatibility wrapper
- no jQuery integration layer
- no separate form-only FileManager
- no alternate non-chunk upload implementation
- no copy fallback based on reading and rewriting file contents
- no move fallback based on copy and delete

## Follow-up areas

See `todo/FEATURE_TODO.md` for optional future work such as richer internal drag operations, resumable upload persistence across browser reloads and additional container interactions.
