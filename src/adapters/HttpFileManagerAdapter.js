import { FileManagerAdapter } from './FileManagerAdapter.js';

const DEFAULT_ENDPOINTS = {
	list: 'list',
	stat: 'stat',
	mkdir: 'mkdir',
	delete: 'delete',
	rmdir: 'rmdir',
	copy: 'copy',
	move: 'move',
	uploadStart: 'upload/start',
	uploadChunk: 'upload/chunk',
	uploadStatus: 'upload/status',
	uploadFinish: 'upload/finish',
	uploadAbort: 'upload/abort',
	download: 'download'
};

function trimSlashes(value) {
	return String(value || '').replace(/^\/+|\/+$/g, '');
}

export class HttpFileManagerAdapter extends FileManagerAdapter {
	constructor(options = {}) {
		super();

		if (!options.baseUrl) {
			throw new Error('HttpFileManagerAdapter requires baseUrl.');
		}

		this.baseUrl = String(options.baseUrl).replace(/\/+$/, '');
		this.endpoints = {
			...DEFAULT_ENDPOINTS,
			...(options.endpoints || {})
		};
		this.headers = {
			...(options.headers || {})
		};
		this.credentials = options.credentials || 'same-origin';
	}

	async list(path = '') {
		return this.requestJson('list', { path });
	}

	async stat(path) {
		return this.requestJson('stat', { path });
	}

	async mkdir(path) {
		return this.requestJson('mkdir', { path });
	}

	async delete(path) {
		return this.requestJson('delete', { path });
	}

	async rmdir(path) {
		return this.requestJson('rmdir', { path });
	}

	async copy(sourcePath, targetPath) {
		return this.requestJson('copy', {
			sourcePath,
			targetPath
		});
	}

	async move(sourcePath, targetPath) {
		return this.requestJson('move', {
			sourcePath,
			targetPath
		});
	}

	async startUpload(upload, options = {}) {
		return this.requestJson('uploadStart', upload, options);
	}

	async uploadChunk(chunk) {
		const url = this.resolveEndpoint('uploadChunk');
		const formData = new FormData();
		formData.append('uploadId', chunk.uploadId);
		formData.append('index', String(chunk.index));
		formData.append('totalChunks', String(chunk.totalChunks));
		formData.append('offset', String(chunk.offset));
		formData.append('size', String(chunk.size));
		formData.append('fileName', chunk.fileName);
		formData.append('chunk', chunk.blob, chunk.fileName);

		return new Promise((resolve, reject) => {
			if (chunk.signal?.aborted) {
				const error = new Error('Upload aborted.');
				error.name = 'AbortError';
				reject(error);
				return;
			}

			const request = new XMLHttpRequest();
			request.open('POST', url, true);
			request.withCredentials = this.credentials === 'include';
			request.timeout = Math.max(0, Number(chunk.timeoutMs) || 0);

			for (const [name, value] of Object.entries(this.headers)) {
				request.setRequestHeader(name, value);
			}

			if (typeof chunk.onProgress === 'function') {
				request.upload.addEventListener('progress', (event) => {
					if (!event.lengthComputable) {
						return;
					}

					chunk.onProgress(event.loaded, event.total);
				});
			}

			const abort = () => request.abort();
			chunk.signal?.addEventListener('abort', abort, { once: true });

			request.addEventListener('load', () => {
				chunk.signal?.removeEventListener('abort', abort);

				if (request.status < 200 || request.status >= 300) {
					reject(this.createHttpError(request));
					return;
				}

				try {
					resolve(request.responseText ? JSON.parse(request.responseText) : {});
				} catch (error) {
					reject(new Error('FileManager upload chunk response is not valid JSON.'));
				}
			});

			request.addEventListener('timeout', () => {
				chunk.signal?.removeEventListener('abort', abort);
				reject(new Error('FileManager upload chunk request timed out.'));
			});

			request.addEventListener('error', () => {
				chunk.signal?.removeEventListener('abort', abort);
				reject(new Error('FileManager upload chunk request failed.'));
			});

			request.addEventListener('abort', () => {
				chunk.signal?.removeEventListener('abort', abort);
				const error = new Error('Upload aborted.');
				error.name = 'AbortError';
				reject(error);
			});

			request.send(formData);
		});
	}

	async getUploadStatus(uploadId) {
		return this.requestJson('uploadStatus', { uploadId });
	}

	async finishUpload(uploadId, options = {}) {
		return this.requestJson('uploadFinish', { uploadId }, options);
	}

	async abortUpload(uploadId) {
		return this.requestJson('uploadAbort', { uploadId });
	}

	getDownloadUrl(path) {
		const url = new URL(this.resolveEndpoint('download'), globalThis.location?.href || 'http://localhost/');
		url.searchParams.set('path', path);
		return url.toString();
	}

	async requestJson(endpointName, payload, options = {}) {
		const requestContext = this.createRequestContext(options.signal, options.timeoutMs);
		let response;

		try {
			response = await fetch(this.resolveEndpoint(endpointName), {
				method: 'POST',
				credentials: this.credentials,
				headers: {
					'Content-Type': 'application/json',
					...this.headers
				},
				body: JSON.stringify(payload || {}),
				signal: requestContext.signal
			});
		} catch (error) {
			if (requestContext.didTimeout()) {
				throw new Error('FileManager request timed out.');
			}

			throw error;
		} finally {
			requestContext.cleanup();
		}

		if (!response.ok) {
			let message = `FileManager request failed with HTTP ${response.status}.`;

			try {
				const errorPayload = await response.json();
				message = errorPayload.message || message;
			} catch (error) {
				// Keep the status based error message.
			}

			throw new Error(message);
		}

		if (response.status === 204) {
			return {};
		}

		return response.json();
	}

	createRequestContext(externalSignal, timeoutMs) {
		const controller = new AbortController();
		let timedOut = false;
		let timeout = null;
		const abortFromExternalSignal = () => controller.abort();

		if (externalSignal?.aborted) {
			controller.abort();
		} else if (externalSignal) {
			externalSignal.addEventListener('abort', abortFromExternalSignal, { once: true });
		}

		const normalizedTimeout = Math.max(0, Number(timeoutMs) || 0);
		if (normalizedTimeout > 0) {
			timeout = setTimeout(() => {
				timedOut = true;
				controller.abort();
			}, normalizedTimeout);
		}

		return {
			signal: controller.signal,
			didTimeout: () => timedOut,
			cleanup: () => {
				if (timeout !== null) {
					clearTimeout(timeout);
				}

				externalSignal?.removeEventListener('abort', abortFromExternalSignal);
			}
		};
	}

	resolveEndpoint(name) {
		const endpoint = this.endpoints[name];

		if (!endpoint) {
			throw new Error(`FileManager HTTP endpoint is not configured: ${name}`);
		}

		if (/^https?:\/\//i.test(endpoint)) {
			return endpoint;
		}

		return `${this.baseUrl}/${trimSlashes(endpoint)}`;
	}

	createHttpError(request) {
		let message = `FileManager request failed with HTTP ${request.status}.`;

		try {
			const payload = JSON.parse(request.responseText || '{}');
			message = payload.message || message;
		} catch (error) {
			// Keep the status based error message.
		}

		return new Error(message);
	}
}
