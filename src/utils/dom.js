export function resolveElement(target) {
	if (typeof target === 'string') {
		const element = document.querySelector(target);

		if (!element) {
			throw new Error(`FileManager target not found: ${target}`);
		}

		return element;
	}

	return target;
}

export function clearElement(element) {
	while (element.firstChild) {
		element.removeChild(element.firstChild);
	}
}

export function createElement(tagName, options = {}) {
	const element = document.createElement(tagName);

	if (options.className) {
		element.className = options.className;
	}

	if (options.text !== undefined) {
		element.textContent = options.text;
	}

	if (options.attrs) {
		for (const [name, value] of Object.entries(options.attrs)) {
			if (value === undefined || value === null || value === false) {
				continue;
			}

			if (value === true) {
				element.setAttribute(name, '');
				continue;
			}

			element.setAttribute(name, String(value));
		}
	}

	if (options.dataset) {
		for (const [name, value] of Object.entries(options.dataset)) {
			if (value === undefined || value === null) {
				continue;
			}

			element.dataset[name] = String(value);
		}
	}

	if (options.children) {
		appendChildren(element, options.children);
	}

	return element;
}

export function createButton(options = {}) {
	const button = createElement('button', {
		className: options.className || 'fm-button',
		text: options.text || '',
		attrs: {
			type: 'button',
			title: options.title,
			disabled: options.disabled || undefined,
			...(options.attrs || {})
		},
		dataset: options.dataset
	});

	if (typeof options.onClick === 'function') {
		button.addEventListener('click', options.onClick);
	}

	return button;
}

export function appendChildren(element, children) {
	for (const child of children) {
		if (child === null || child === undefined || child === false) {
			continue;
		}

		if (Array.isArray(child)) {
			appendChildren(element, child);
			continue;
		}

		if (typeof child === 'string' || typeof child === 'number') {
			element.appendChild(document.createTextNode(String(child)));
			continue;
		}

		element.appendChild(child);
	}
}
