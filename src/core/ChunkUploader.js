function sleep(milliseconds) {
	if (!milliseconds) {
		return Promise.resolve();
	}

	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isAbortError(error) {
	return error?.name === 'AbortError';
}

export class ChunkUploader {
	constructor(adapter, options = {}) {
		this.adapter = adapter;
		this.options = {
			chunkSize: 8 * 1024 * 1024,
			maxParallelChunks: 2,
			retryLimit: 3,
			retryDelayMs: 500,
			...options
		};
	}

	async upload(task, hooks = {}) {
		const file = task.file;
		const chunkSize = Math.max(1, Number(this.options.chunkSize) || 1);
		const totalChunks = Math.max(1, Math.ceil(file.size / chunkSize));
		const abortController = task.abortController || new AbortController();
		task.abortController = abortController;

		const requestOptions = {
			signal: abortController.signal,
			timeoutMs: Number(this.options.timeoutMs) || 0
		};

		const session = await this.adapter.startUpload({
			uploadId: task.uploadId || null,
			path: task.path || '',
			name: file.name,
			size: file.size,
			type: file.type || '',
			lastModified: file.lastModified || null,
			chunkSize,
			totalChunks
		}, requestOptions);

		if (!session?.uploadId) {
			throw new Error('FileManager upload start response requires uploadId.');
		}

		task.uploadId = session.uploadId;
		hooks.onUploadId?.(session.uploadId);

		this.throwIfAborted(abortController.signal);

		const uploadedChunks = new Set(
			Array.isArray(session.uploadedChunks) ? session.uploadedChunks.map(Number) : []
		);
		const chunkProgress = new Map();

		for (const index of uploadedChunks) {
			chunkProgress.set(index, this.getChunkSize(file.size, chunkSize, index, totalChunks));
		}

		this.reportProgress(file.size, chunkProgress, hooks);

		const pendingIndexes = [];
		for (let index = 0; index < totalChunks; index += 1) {
			if (!uploadedChunks.has(index)) {
				pendingIndexes.push(index);
			}
		}

		let cursor = 0;
		const workerCount = Math.max(1, Math.min(
			Number(this.options.maxParallelChunks) || 1,
			pendingIndexes.length || 1
		));

		const workers = Array.from({ length: workerCount }, async () => {
			while (cursor < pendingIndexes.length) {
				if (abortController.signal.aborted) {
					const error = new Error('Upload aborted.');
					error.name = 'AbortError';
					throw error;
				}

				const index = pendingIndexes[cursor];
				cursor += 1;
				await this.uploadChunk(task, index, totalChunks, chunkSize, chunkProgress, hooks);
			}
		});

		await Promise.all(workers);
		this.throwIfAborted(abortController.signal);
		hooks.onState?.('finalizing');
		const descriptor = await this.adapter.finishUpload(session.uploadId, requestOptions);
		this.throwIfAborted(abortController.signal);
		this.reportProgress(file.size, new Map([[0, file.size]]), hooks);
		return descriptor;
	}

	async uploadChunk(task, index, totalChunks, chunkSize, chunkProgress, hooks) {
		const file = task.file;
		const offset = index * chunkSize;
		const end = Math.min(file.size, offset + chunkSize);
		const size = Math.max(0, end - offset);
		const blob = file.slice(offset, end);
		const retryLimit = Math.max(0, Number(this.options.retryLimit) || 0);
		let attempt = 0;

		while (true) {
			try {
				await this.adapter.uploadChunk({
					uploadId: task.uploadId,
					index,
					totalChunks,
					offset,
					size,
					fileName: file.name,
					timeoutMs: Number(this.options.timeoutMs) || 0,
					blob,
					signal: task.abortController.signal,
					onProgress: (loaded) => {
						chunkProgress.set(index, Math.min(size, Math.max(0, Number(loaded) || 0)));
						this.reportProgress(file.size, chunkProgress, hooks);
					}
				});

				chunkProgress.set(index, size);
				this.reportProgress(file.size, chunkProgress, hooks);
				return;
			} catch (error) {
				if (isAbortError(error) || task.abortController.signal.aborted) {
					throw error;
				}

				if (attempt >= retryLimit) {
					throw error;
				}

				attempt += 1;
				hooks.onRetry?.({
					index,
					attempt,
					error
				});
				await sleep(Number(this.options.retryDelayMs) || 0);
				this.throwIfAborted(task.abortController.signal);
			}
		}
	}

	throwIfAborted(signal) {
		if (!signal?.aborted) {
			return;
		}

		const error = new Error('Upload aborted.');
		error.name = 'AbortError';
		throw error;
	}

	async abort(task) {
		task.abortController?.abort();

		if (task.uploadId) {
			await this.adapter.abortUpload(task.uploadId);
		}
	}

	getChunkSize(fileSize, chunkSize, index, totalChunks) {
		if (fileSize === 0 && totalChunks === 1) {
			return 0;
		}

		const offset = index * chunkSize;
		return Math.max(0, Math.min(chunkSize, fileSize - offset));
	}

	reportProgress(totalBytes, chunkProgress, hooks) {
		let uploadedBytes = 0;

		for (const value of chunkProgress.values()) {
			uploadedBytes += Number(value) || 0;
		}

		const progress = totalBytes === 0 ? 1 : Math.min(1, uploadedBytes / totalBytes);
		hooks.onProgress?.({
			uploadedBytes: Math.min(totalBytes, uploadedBytes),
			totalBytes,
			progress
		});
	}
}
