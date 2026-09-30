# Feature Todo

The first implementation covers the required architecture and upload/file-management core.

Possible follow-up work:

- persistent resume metadata across browser reloads when the host can reacquire the same local file
- richer per-file preview renderers
- internal drag of existing files onto folders
- keyboard selection model for container rows
- optional context menu plugin
- optional bulk download plugin
- optional checksum exchange for upload verification
- optional server capability discovery if a future protocol needs it
- more detailed accessibility review for large container tables
- dedicated BASE3 backend-service reference implementation using the current ResourceFoundation copy and move contract

These items should extend the existing core. They must not create alternate upload or form paths.
