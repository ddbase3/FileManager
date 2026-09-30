function normalizeAcceptTokens(accept) {
	if (Array.isArray(accept)) {
		return accept.map((value) => String(value).trim()).filter(Boolean);
	}

	return String(accept || '')
		.split(',')
		.map((value) => value.trim())
		.filter(Boolean);
}

export function fileMatchesAccept(file, accept) {
	const tokens = normalizeAcceptTokens(accept);

	if (tokens.length === 0) {
		return true;
	}

	const name = String(file?.name || '').toLowerCase();
	const type = String(file?.type || '').toLowerCase();

	return tokens.some((token) => {
		const normalized = token.toLowerCase();

		if (normalized.startsWith('.')) {
			return name.endsWith(normalized);
		}

		if (normalized.endsWith('/*')) {
			return type.startsWith(normalized.slice(0, -1));
		}

		return type === normalized;
	});
}

export function formatBytes(bytes) {
	const value = Number(bytes || 0);

	if (value < 1024) {
		return `${value} B`;
	}

	const units = ['KB', 'MB', 'GB', 'TB'];
	let current = value / 1024;
	let unitIndex = 0;

	while (current >= 1024 && unitIndex < units.length - 1) {
		current /= 1024;
		unitIndex += 1;
	}

	const digits = current >= 100 ? 0 : current >= 10 ? 1 : 2;
	return `${current.toFixed(digits)} ${units[unitIndex]}`;
}

export function createUploadTaskId() {
	if (globalThis.crypto?.randomUUID) {
		return globalThis.crypto.randomUUID();
	}

	return `upload_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function joinPath(basePath, name) {
	const base = String(basePath || '').replace(/\/+$/, '');
	const child = String(name || '').replace(/^\/+/, '');

	if (!base) {
		return child;
	}

	if (!child) {
		return base;
	}

	return `${base}/${child}`;
}

export function parentPath(path) {
	const normalized = String(path || '').replace(/\/+$/, '');
	const index = normalized.lastIndexOf('/');

	if (index < 0) {
		return '';
	}

	return normalized.slice(0, index);
}

export function baseName(path) {
	const normalized = String(path || '').replace(/\/+$/, '');
	const index = normalized.lastIndexOf('/');
	return index < 0 ? normalized : normalized.slice(index + 1);
}

export function splitPath(path) {
	const normalized = String(path || '').replace(/^\/+|\/+$/g, '');

	if (!normalized) {
		return [];
	}

	return normalized.split('/').filter(Boolean);
}
