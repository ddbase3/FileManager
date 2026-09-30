export class FileManagerAdapter {
	async list(path = '') {
		throw new Error('FileManagerAdapter.list() is not implemented.');
	}

	async stat(path) {
		throw new Error('FileManagerAdapter.stat() is not implemented.');
	}

	async mkdir(path) {
		throw new Error('FileManagerAdapter.mkdir() is not implemented.');
	}

	async delete(path) {
		throw new Error('FileManagerAdapter.delete() is not implemented.');
	}

	async rmdir(path) {
		throw new Error('FileManagerAdapter.rmdir() is not implemented.');
	}

	async copy(sourcePath, targetPath) {
		throw new Error('FileManagerAdapter.copy() is not implemented.');
	}

	async move(sourcePath, targetPath) {
		throw new Error('FileManagerAdapter.move() is not implemented.');
	}

	async startUpload(upload, options = {}) {
		throw new Error('FileManagerAdapter.startUpload() is not implemented.');
	}

	async uploadChunk(chunk) {
		throw new Error('FileManagerAdapter.uploadChunk() is not implemented.');
	}

	async getUploadStatus(uploadId) {
		throw new Error('FileManagerAdapter.getUploadStatus() is not implemented.');
	}

	async finishUpload(uploadId, options = {}) {
		throw new Error('FileManagerAdapter.finishUpload() is not implemented.');
	}

	async abortUpload(uploadId) {
		throw new Error('FileManagerAdapter.abortUpload() is not implemented.');
	}

	getDownloadUrl(path) {
		return '';
	}
}
