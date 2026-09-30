export function formatString(template, replacements = {}) {
	return Object.entries(replacements).reduce((text, [key, replacement]) => {
		return text.split(`{${key}}`).join(String(replacement));
	}, String(template ?? ''));
}

export function formatDateTime(value) {
	if (!value) {
		return '';
	}

	const date = value instanceof Date ? value : new Date(value);

	if (Number.isNaN(date.getTime())) {
		return String(value);
	}

	return date.toLocaleString();
}
