# BASE3 Backend with ResourceFoundation IFileStorage

FileManager does not depend on ResourceFoundation directly.

A BASE3 backend service can implement the FileManager HTTP protocol and use `ResourceFoundation\Api\IFileStorage` behind it.

## Current IFileStorage contract

The current ResourceFoundation contract provides:

```php
public function list(string $path = ''): array;
public function read(string $path): string;
public function write(string $path, string $content): bool;
public function copy(string $source, string $target): bool;
public function move(string $source, string $target): bool;
public function delete(string $path): bool;
public function mkdir(string $path): bool;
public function rmdir(string $path): bool;
public function exists(string $path): bool;
public function stat(string $path): ?array;
```

The HTTP service remains responsible for authorization, request validation, upload sessions and descriptor normalization. Storage access itself stays behind `IFileStorage`.

## Operation mapping

A typical backend mapping is:

```text
FileManager HTTP             ResourceFoundation
---------------------------------------------------------
list(path)                   IFileStorage::list(path)
stat(path)                   IFileStorage::stat(path)
mkdir(path)                  IFileStorage::mkdir(path)
delete(path)                 IFileStorage::delete(path)
rmdir(path)                  IFileStorage::rmdir(path)
copy(source, target)         IFileStorage::copy(source, target)
move(source, target)         IFileStorage::move(source, target)
```

`copy()` and `move()` are native storage operations. The ES module does not emulate them by reading file contents, uploading them again, or combining unrelated browser operations.

The current `IFileStorage` PHPDoc defines `copy()` and `move()` for files within one logical storage instance. If container mode is also allowed to copy or move directories, those directory semantics belong to the backend service. The browser still uses the same `copy` and `move` operations and does not implement recursive storage logic itself.

Cross-storage copy and move also belong to the calling backend service, as defined by the ResourceFoundation contract.

## Chunk upload service

Chunk sessions are a backend transport concern in front of final file storage.

Conceptually:

```text
HTTP upload/start
  -> create or resume upload session

HTTP upload/chunk
  -> persist one temporary chunk

HTTP upload/finish
  -> validate all chunks
  -> finalize temporary content
  -> store the final file through the active storage backend
  -> return a file descriptor
```

The upload session should track at least:

- upload ID
- destination path
- original filename
- file size
- MIME type
- chunk size
- total chunk count
- completed chunk indexes
- creation time
- last activity time

A repeated `upload/start` request with an existing upload ID should return the same session when it is still valid and include the already completed chunk indexes. This is what allows FileManager to retry a failed upload without re-sending completed chunks.

## Important large-file boundary

`IFileStorage::write()` accepts the complete content as a PHP string.

That is not a suitable finalization boundary for arbitrarily large files if an implementation would need to assemble the complete upload in PHP memory first.

Do not hide this limitation in the browser module.

A backend intended for multi-gigabyte uploads should finalize temporary upload data through a storage capability that can consume a file or stream without complete in-memory materialization. If ResourceFoundation adds such a contract, the upload service should use it at that backend boundary.

## Descriptor mapping

`IFileStorage::list()` and `stat()` return backend-defined arrays. The FileManager HTTP service normalizes them before sending them to the browser.

Required browser fields are:

```text
id
name
path
kind
```

Recommended additional fields are:

```text
size
mimeType
modifiedAt
metadata
```

Stable `id` values are especially important because single and collection form controls submit IDs instead of file content or browser-local paths.

## Security

The backend service owns:

- authorization for every path and operation
- path normalization
- root or container isolation
- filename validation
- quota checks
- final MIME validation where required
- virus or content scanning where required
- CSRF protection for browser requests
- stale chunk-session cleanup

Do not rely on browser validation for security decisions.
