import { FileManagerAdapter } from './FileManagerAdapter.js';
import { baseName, joinPath, parentPath } from '../utils/files.js';

function cloneDescriptor(item) {
	return item ? { ...item } : item;
}

export class MemoryFileManagerAdapter extends FileManagerAdapter {
	constructor(options = {}) {
		super();
		this.entries = new Map();
		this.uploads = new Map();
		this.containerId = options.containerId || 'memory-root';
		this.sequence = 1;

		this.entries.set('', {
			id: this.containerId,
			name: '',
			path: '',
			kind: 'directory',
			modifiedAt: new Date().toISOString()
		});

		for (const item of options.items || []) {
			this.entries.set(item.path, cloneDescriptor(item));
		}
	}

	async list(path = '') {
		const directory = this.entries.get(path);

		if (!directory || directory.kind !== 'directory') {
			throw new Error(`Directory not found: ${path}`);
		}

		const items = [];

		for (const item of this.entries.values()) {
			if (item.path !== path && parentPath(item.path) === path) {
				items.push(cloneDescriptor(item));
			}
		}

		items.sort((left, right) => {
			if (left.kind !== right.kind) {
				return left.kind === 'directory' ? -1 : 1;
			}

			return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
		});

		return {
			containerId: this.containerId,
			path,
			items
		};
	}

	async stat(path) {
		return cloneDescriptor(this.entries.get(path) || null);
	}

	async mkdir(path) {
		if (this.entries.has(path)) {
			throw new Error(`Path already exists: ${path}`);
		}

		const descriptor = {
			id: `dir_${this.sequence++}`,
			name: baseName(path),
			path,
			kind: 'directory',
			modifiedAt: new Date().toISOString()
		};
		this.entries.set(path, descriptor);
		return cloneDescriptor(descriptor);
	}

	async delete(path) {
		this.entries.delete(path);
		return { success: true };
	}

	async rmdir(path) {
		for (const entryPath of [...this.entries.keys()]) {
			if (entryPath === path || entryPath.startsWith(`${path}/`)) {
				this.entries.delete(entryPath);
			}
		}

		return { success: true };
	}

	async copy(sourcePath, targetPath) {
		const source = this.entries.get(sourcePath);

		if (!source) {
			throw new Error(`Source path not found: ${sourcePath}`);
		}

		const copies = [...this.entries.values()]
			.filter((item) => item.path === sourcePath || item.path.startsWith(`${sourcePath}/`))
			.sort((left, right) => left.path.length - right.path.length);

		let rootCopy = null;

		for (const item of copies) {
			const suffix = item.path.slice(sourcePath.length);
			const copyPath = `${targetPath}${suffix}`;
			const copy = {
				...item,
				id: `${item.kind === 'directory' ? 'dir' : 'file'}_${this.sequence++}`,
				name: baseName(copyPath),
				path: copyPath,
				modifiedAt: new Date().toISOString()
			};
			this.entries.set(copyPath, copy);

			if (item.path === sourcePath) {
				rootCopy = copy;
			}
		}

		return cloneDescriptor(rootCopy);
	}

	async move(sourcePath, targetPath) {
		const movedItems = [...this.entries.values()]
			.filter((item) => item.path === sourcePath || item.path.startsWith(`${sourcePath}/`))
			.sort((left, right) => left.path.length - right.path.length);

		if (movedItems.length === 0) {
			throw new Error(`Source path not found: ${sourcePath}`);
		}

		for (const item of movedItems) {
			this.entries.delete(item.path);
		}

		let rootMove = null;

		for (const item of movedItems) {
			const suffix = item.path.slice(sourcePath.length);
			const movePath = `${targetPath}${suffix}`;
			const moved = {
				...item,
				name: baseName(movePath),
				path: movePath,
				modifiedAt: new Date().toISOString()
			};
			this.entries.set(movePath, moved);

			if (item.path === sourcePath) {
				rootMove = moved;
			}
		}

		return cloneDescriptor(rootMove);
	}

	async startUpload(upload) {
		const uploadId = upload.uploadId || `memory_upload_${this.sequence++}`;
		let record = this.uploads.get(uploadId);

		if (!record) {
			record = {
				...upload,
				uploadId,
				uploadedChunks: new Set()
			};
			this.uploads.set(uploadId, record);
		}

		return {
			uploadId,
			uploadedChunks: [...record.uploadedChunks]
		};
	}

	async uploadChunk(chunk) {
		const upload = this.uploads.get(chunk.uploadId);

		if (!upload) {
			throw new Error(`Upload not found: ${chunk.uploadId}`);
		}

		if (chunk.signal?.aborted) {
			const error = new Error('Upload aborted.');
			error.name = 'AbortError';
			throw error;
		}

		chunk.onProgress?.(chunk.size, chunk.size);
		upload.uploadedChunks.add(chunk.index);
		return { index: chunk.index };
	}

	async getUploadStatus(uploadId) {
		const upload = this.uploads.get(uploadId);

		if (!upload) {
			throw new Error(`Upload not found: ${uploadId}`);
		}

		return {
			uploadId,
			uploadedChunks: [...upload.uploadedChunks]
		};
	}

	async finishUpload(uploadId) {
		const upload = this.uploads.get(uploadId);

		if (!upload) {
			throw new Error(`Upload not found: ${uploadId}`);
		}

		const path = joinPath(upload.path, upload.name);
		const descriptor = {
			id: `file_${this.sequence++}`,
			name: upload.name,
			path,
			kind: 'file',
			size: upload.size,
			mimeType: upload.type || 'application/octet-stream',
			modifiedAt: new Date().toISOString()
		};
		this.entries.set(path, descriptor);
		this.uploads.delete(uploadId);
		return cloneDescriptor(descriptor);
	}

	async abortUpload(uploadId) {
		this.uploads.delete(uploadId);
		return { success: true };
	}

	getDownloadUrl(path) {
		return `memory://${encodeURIComponent(path)}`;
	}
}
