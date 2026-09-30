import { FileManager, MemoryFileManagerAdapter } from '../../src/index.js';

const results = document.querySelector('#results');

function assert(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

function report(message, passed = true) {
	const line = document.createElement('div');
	line.className = passed ? 'fm-smoke-pass' : 'fm-smoke-fail';
	line.textContent = `${passed ? 'PASS' : 'FAIL'}: ${message}`;
	results.appendChild(line);
}

try {
	const collectionAdapter = new MemoryFileManagerAdapter();
	const collection = new FileManager('#collectionFixture', {
		mode: 'collection',
		adapter: collectionAdapter,
		form: {
			name: 'attachments'
		},
		upload: {
			chunkSize: 4,
			maxParallelChunks: 2
		}
	});
	collection.init();
	collection.addFiles([
		new File(['abcdefghij'], 'test.txt', { type: 'text/plain' })
	]);
	await collection.waitForUploads();

	assert(collection.getValue().length === 1, 'Collection should contain one uploaded file ID.');
	assert(document.querySelector('[name="title"]').value === 'Keep me', 'Other form fields must remain unchanged.');
	const hidden = document.querySelector('[name="attachments"]');
	assert(hidden, 'Form binding should create the configured hidden field.');
	assert(JSON.parse(hidden.value).length === 1, 'Collection hidden field should contain one file ID.');
	report('collection upload and form binding');

	const containerAdapter = new MemoryFileManagerAdapter({
		items: [
			{
				id: 'dir_docs',
				name: 'Docs',
				path: 'Docs',
				kind: 'directory',
				modifiedAt: '2026-09-30T08:00:00Z'
			},
			{
				id: 'file_one',
				name: 'one.txt',
				path: 'one.txt',
				kind: 'file',
				size: 3,
				mimeType: 'text/plain',
				modifiedAt: '2026-09-30T08:00:00Z'
			}
		]
	});
	const container = new FileManager('#containerFixture', {
		mode: 'container',
		adapter: containerAdapter
	});
	container.init();
	await container.ready;
	assert(container.getState().entries.length === 2, 'Container should load root entries.');
	container.toggleSelection('one.txt');
	await container.copySelected('Docs');
	await container.navigate('Docs');
	assert(container.getState().entries.some((item) => item.name === 'one.txt'), 'Container copy should use adapter.copy().');
	report('container browsing and native copy');
} catch (error) {
	report(error.message, false);
	throw error;
}
