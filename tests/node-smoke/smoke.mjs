import assert from 'node:assert/strict';
import { FileManagerEventBus } from '../../src/core/FileManagerEventBus.js';
import { UploadQueue } from '../../src/core/UploadQueue.js';
import { MemoryFileManagerAdapter } from '../../src/adapters/MemoryFileManagerAdapter.js';
import { fileMatchesAccept, formatBytes, joinPath, parentPath } from '../../src/utils/files.js';

class RetryMemoryAdapter extends MemoryFileManagerAdapter {
	constructor() {
		super();
		this.failedOnce = false;
		this.chunkCalls = [];
	}

	async uploadChunk(chunk) {
		this.chunkCalls.push(chunk.index);

		if (chunk.index === 1 && !this.failedOnce) {
			this.failedOnce = true;
			throw new Error('Synthetic chunk failure.');
		}

		return super.uploadChunk(chunk);
	}
}

class FailedUploadAdapter extends MemoryFileManagerAdapter {
	constructor() {
		super();
		this.abortCalls = [];
	}

	async uploadChunk() {
		throw new Error('Synthetic permanent failure.');
	}

	async abortUpload(uploadId) {
		this.abortCalls.push(uploadId);
		return super.abortUpload(uploadId);
	}
}

class SlowFinalizeAdapter extends MemoryFileManagerAdapter {
	async finishUpload(uploadId, options = {}) {
		return new Promise((resolve, reject) => {
			const abort = () => {
				const error = new Error('Upload aborted.');
				error.name = 'AbortError';
				reject(error);
			};

			if (options.signal?.aborted) {
				abort();
				return;
			}

			options.signal?.addEventListener('abort', abort, { once: true });
		});
	}
}

function createFile(name, content, type = 'application/octet-stream') {
	const blob = new Blob([content], { type });
	return {
		name,
		type,
		size: blob.size,
		lastModified: 1,
		slice: blob.slice.bind(blob)
	};
}

assert.equal(joinPath('docs', 'report.pdf'), 'docs/report.pdf');
assert.equal(joinPath('', 'report.pdf'), 'report.pdf');
assert.equal(parentPath('docs/reports/report.pdf'), 'docs/reports');
assert.equal(formatBytes(1024), '1.00 KB');
assert.equal(fileMatchesAccept(createFile('report.pdf', 'x', 'application/pdf'), '.pdf,image/*'), true);
assert.equal(fileMatchesAccept(createFile('report.txt', 'x', 'text/plain'), '.pdf,image/*'), false);

const events = new FileManagerEventBus();
const adapter = new RetryMemoryAdapter();
const queue = new UploadQueue(adapter, events, {
	chunkSize: 4,
	maxParallelFiles: 1,
	maxParallelChunks: 2,
	retryLimit: 2,
	retryDelayMs: 0
});
let retries = 0;
let completed = null;
events.on('upload:retry', () => {
	retries += 1;
});
events.on('upload:completed', ({ item }) => {
	completed = item;
});

queue.add([createFile('large.bin', 'abcdefghijkl', 'application/octet-stream')], {
	path: 'uploads'
});
await queue.waitForIdle();

assert.equal(retries, 1);
assert.equal(adapter.chunkCalls.filter((index) => index === 1).length, 2);
assert.equal(completed.name, 'large.bin');
assert.equal(completed.path, 'uploads/large.bin');
assert.equal(queue.getTasks()[0].state, 'completed');
assert.equal(queue.getTasks()[0].progress, 1);

const storageAdapter = new MemoryFileManagerAdapter({
	items: [
		{
			id: 'dir_docs',
			name: 'Docs',
			path: 'Docs',
			kind: 'directory',
			modifiedAt: '2026-09-30T08:00:00Z'
		},
		{
			id: 'file_source',
			name: 'source.txt',
			path: 'source.txt',
			kind: 'file',
			size: 3,
			mimeType: 'text/plain',
			modifiedAt: '2026-09-30T08:00:00Z'
		}
	]
});
await storageAdapter.copy('source.txt', 'Docs/source.txt');
assert.equal((await storageAdapter.stat('Docs/source.txt')).name, 'source.txt');
await storageAdapter.move('Docs/source.txt', 'Docs/moved.txt');
assert.equal(await storageAdapter.stat('Docs/source.txt'), null);
assert.equal((await storageAdapter.stat('Docs/moved.txt')).name, 'moved.txt');

const failedEvents = new FileManagerEventBus();
const failedAdapter = new FailedUploadAdapter();
const failedQueue = new UploadQueue(failedAdapter, failedEvents, {
	chunkSize: 4,
	maxParallelFiles: 1,
	maxParallelChunks: 1,
	retryLimit: 0,
	retryDelayMs: 0
});
failedQueue.add([createFile('failed.bin', 'abcdefgh')]);
await assert.rejects(() => failedQueue.waitForIdle());
const failedTask = failedQueue.getTasks()[0];
assert.equal(failedTask.state, 'failed');
assert.ok(failedTask.uploadId);
const failedUploadId = failedTask.uploadId;
await failedQueue.remove(failedTask.id);
assert.deepEqual(failedAdapter.abortCalls, [failedUploadId]);
assert.equal(failedQueue.getTasks().length, 0);

const cancelEvents = new FileManagerEventBus();
const cancelAdapter = new SlowFinalizeAdapter();
const cancelQueue = new UploadQueue(cancelAdapter, cancelEvents, {
	chunkSize: 64,
	maxParallelFiles: 1,
	maxParallelChunks: 1,
	retryLimit: 0
});
let cancelPromise = null;
cancelEvents.on('queue:change', ({ tasks }) => {
	const task = tasks[0];
	if (task?.state === 'finalizing' && !cancelPromise) {
		cancelPromise = cancelQueue.cancel(task.id);
	}
});
cancelQueue.add([createFile('cancel.bin', 'abcdefgh')]);
await cancelQueue.waitForIdle({ rejectOnFailed: false });
await cancelPromise;
assert.equal(cancelQueue.getTasks()[0].state, 'cancelled');

console.log('FileManager node smoke passed.');
