import { createUploadTaskId } from '../utils/files.js';
import { ChunkUploader } from './ChunkUploader.js';

const PENDING_STATES = new Set(['queued', 'uploading', 'finalizing']);

export class UploadQueue {
	constructor(adapter, events, options = {}) {
		this.adapter = adapter;
		this.events = events;
		this.options = {
			maxParallelFiles: 3,
			...options
		};
		this.uploader = new ChunkUploader(adapter, options);
		this.tasks = [];
		this.activeCount = 0;
		this.idleWaiters = new Set();
	}

	add(files, context = {}) {
		const added = [];

		for (const file of Array.from(files || [])) {
			const task = {
				id: createUploadTaskId(),
				file,
				path: context.path || '',
				state: 'queued',
				progress: 0,
				uploadedBytes: 0,
				totalBytes: file.size,
				uploadId: null,
				result: null,
				error: null,
				abortController: null
			};
			this.tasks.push(task);
			added.push(task);
			this.events.emit('upload:queued', { task });
		}

		this.emitChange();
		this.pump();
		return added;
	}

	getTasks() {
		return this.tasks;
	}

	getTask(taskId) {
		return this.tasks.find((task) => task.id === taskId) || null;
	}

	hasPending() {
		return this.tasks.some((task) => PENDING_STATES.has(task.state));
	}

	hasFailed() {
		return this.tasks.some((task) => task.state === 'failed');
	}

	async cancel(taskId) {
		const task = this.getTask(taskId);

		if (!task || !PENDING_STATES.has(task.state)) {
			return;
		}

		if (task.state === 'queued') {
			task.state = 'cancelled';
			task.error = null;
			this.events.emit('upload:cancelled', { task });
			this.emitChange();
			this.resolveIdleWaitersIfNeeded();
			return;
		}

		try {
			await this.uploader.abort(task);
		} finally {
			task.uploadId = null;
		}
	}

	retry(taskId) {
		const task = this.getTask(taskId);

		if (!task || !['failed', 'cancelled'].includes(task.state)) {
			return;
		}

		task.state = 'queued';
		task.error = null;
		task.progress = 0;
		task.uploadedBytes = 0;
		task.abortController = null;
		this.events.emit('upload:requeued', { task });
		this.emitChange();
		this.pump();
	}

	async remove(taskId) {
		const index = this.tasks.findIndex((task) => task.id === taskId);

		if (index < 0 || PENDING_STATES.has(this.tasks[index].state)) {
			return false;
		}

		const task = this.tasks[index];
		if (task.uploadId) {
			try {
				await this.adapter.abortUpload(task.uploadId);
			} catch (error) {
				this.events.emit('upload:cleanup-failed', { task, error });
			}

			task.uploadId = null;
		}

		const currentIndex = this.tasks.indexOf(task);
		if (currentIndex >= 0) {
			this.tasks.splice(currentIndex, 1);
		}

		this.emitChange();
		return true;
	}

	clearCompleted() {
		this.tasks = this.tasks.filter((task) => task.state !== 'completed');
		this.emitChange();
	}

	waitForIdle(options = {}) {
		const rejectOnFailed = options.rejectOnFailed !== false;

		if (!this.hasPending()) {
			return this.finishIdleWait(rejectOnFailed);
		}

		return new Promise((resolve, reject) => {
			this.idleWaiters.add({ resolve, reject, rejectOnFailed });
		});
	}

	pump() {
		const maxParallelFiles = Math.max(1, Number(this.options.maxParallelFiles) || 1);

		while (this.activeCount < maxParallelFiles) {
			const task = this.tasks.find((candidate) => candidate.state === 'queued');

			if (!task) {
				break;
			}

			this.startTask(task);
		}

		this.resolveIdleWaitersIfNeeded();
	}

	async startTask(task) {
		this.activeCount += 1;
		task.state = 'uploading';
		task.abortController = new AbortController();
		this.events.emit('upload:started', { task });
		this.emitChange();

		try {
			const result = await this.uploader.upload(task, {
				onState: (state) => {
					task.state = state;
					this.emitChange();
				},
				onUploadId: (uploadId) => {
					task.uploadId = uploadId;
				},
				onProgress: ({ uploadedBytes, totalBytes, progress }) => {
					task.uploadedBytes = uploadedBytes;
					task.totalBytes = totalBytes;
					task.progress = progress;
					this.events.emit('upload:progress', { task, uploadedBytes, totalBytes, progress });
					this.emitChange();
				},
				onRetry: ({ index, attempt, error }) => {
					this.events.emit('upload:retry', { task, index, attempt, error });
				}
			});

			task.state = 'completed';
			task.progress = 1;
			task.uploadedBytes = task.totalBytes;
			task.result = result;
			task.error = null;
			task.uploadId = null;
			this.events.emit('upload:completed', { task, item: result });
		} catch (error) {
			if (task.abortController?.signal.aborted || error?.name === 'AbortError') {
				task.state = 'cancelled';
				task.error = null;
				this.events.emit('upload:cancelled', { task });
			} else {
				task.state = 'failed';
				task.error = error;
				this.events.emit('upload:failed', { task, error });
			}
		} finally {
			this.activeCount -= 1;
			this.emitChange();
			this.pump();
		}
	}

	emitChange() {
		this.events.emit('queue:change', {
			tasks: this.tasks
		});
	}

	resolveIdleWaitersIfNeeded() {
		if (this.hasPending()) {
			return;
		}

		this.events.emit('queue:idle', { tasks: this.tasks });

		for (const waiter of this.idleWaiters) {
			this.completeWaiter(waiter);
		}

		this.idleWaiters.clear();
	}

	finishIdleWait(rejectOnFailed) {
		if (rejectOnFailed && this.hasFailed()) {
			return Promise.reject(new Error('One or more file uploads failed.'));
		}

		return Promise.resolve(this.tasks);
	}

	completeWaiter(waiter) {
		if (waiter.rejectOnFailed && this.hasFailed()) {
			waiter.reject(new Error('One or more file uploads failed.'));
			return;
		}

		waiter.resolve(this.tasks);
	}
}
