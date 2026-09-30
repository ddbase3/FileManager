# Form Binding

Form binding is optional.

The same `FileManager` class is used with or without a form.

## Configuration

```javascript
const manager = new FileManager('#attachments', {
	mode: 'collection',
	adapter,
	form: {
		name: 'attachments'
	}
});
```

If `form.form` is not supplied, the adapter uses the closest ancestor form of the FileManager target.

A specific form can be supplied as an element or selector:

```javascript
form: {
	form: '#articleForm',
	name: 'attachments'
}
```

## Field ownership

The adapter creates one hidden input with the configured name.

It does not alter any other controls in the form.

## Values

### Single

```text
file_123
```

### Collection

```json
["file_123","file_456"]
```

### Container

```text
container_123
```

If the backend has no container ID, container mode falls back to the configured root path.

## Submit behavior

If no upload is active, normal form submission continues immediately.

If uploads are queued or active, the binding intercepts that submit in the capture phase, prevents it from reaching the form's normal submit handlers, waits for the existing queue and then calls `requestSubmit()` again with the original submitter when available.

The second submit goes through normal browser form validation and the form's existing submit handlers. This prevents application submit logic from running once with incomplete FileManager values and then a second time after the upload finishes.

If an upload failed, submission stays blocked. The user must retry or remove the failed upload task.

## Custom serialization

A host may provide:

```javascript
form: {
	name: 'attachments',
	serialize(value, manager) {
		return JSON.stringify({ files: value });
	}
}
```

This changes only the hidden field serialization. It does not create a separate form mode.
