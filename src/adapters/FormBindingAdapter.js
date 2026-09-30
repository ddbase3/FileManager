export class FormBindingAdapter {
	constructor(manager, options = {}) {
		this.manager = manager;
		this.options = options;
		this.form = null;
		this.input = null;
		this.unsubscribe = null;
		this.submitHandler = null;
	}

	init() {
		if (!this.options.name) {
			throw new Error('FileManager form binding requires a field name.');
		}

		this.form = this.resolveForm();

		if (!this.form) {
			throw new Error('FileManager form binding could not resolve a form.');
		}

		this.input = document.createElement('input');
		this.input.type = 'hidden';
		this.input.name = this.options.name;
		this.input.dataset.fileManagerField = this.options.name;
		this.form.appendChild(this.input);
		this.syncValue();

		this.unsubscribe = this.manager.on('value:change', () => this.syncValue());
		this.submitHandler = (event) => this.handleSubmit(event);
		this.form.addEventListener('submit', this.submitHandler, true);

		return this;
	}

	resolveForm() {
		if (typeof this.options.form === 'string') {
			return document.querySelector(this.options.form);
		}

		if (this.options.form) {
			return this.options.form;
		}

		return this.manager.target.closest('form');
	}

	syncValue() {
		if (!this.input) {
			return;
		}

		this.input.value = this.serializeValue(this.manager.getValue());
	}

	serializeValue(value) {
		if (typeof this.options.serialize === 'function') {
			return String(this.options.serialize(value, this.manager));
		}

		if (Array.isArray(value)) {
			return JSON.stringify(value);
		}

		return value === null || value === undefined ? '' : String(value);
	}

	async handleSubmit(event) {
		if (this.options.waitForUploads === false) {
			this.syncValue();
			return;
		}

		if (!this.manager.hasPendingUploads() && !this.manager.hasFailedUploads()) {
			this.syncValue();
			return;
		}

		event.preventDefault();
		event.stopImmediatePropagation();
		const submitter = event.submitter || null;

		try {
			await this.manager.waitForUploads();
			this.syncValue();
			this.submitForm(submitter);
		} catch (error) {
			this.manager.events.emit('form:submit-blocked', {
				error,
				manager: this.manager
			});
		}
	}

	submitForm(submitter) {
		if (typeof this.form.requestSubmit === 'function') {
			this.form.requestSubmit(submitter || undefined);
			return;
		}

		const fallbackSubmitter = document.createElement('button');
		fallbackSubmitter.type = 'submit';
		fallbackSubmitter.hidden = true;
		this.form.appendChild(fallbackSubmitter);

		try {
			fallbackSubmitter.click();
		} finally {
			fallbackSubmitter.remove();
		}
	}

	destroy() {
		this.unsubscribe?.();

		if (this.form && this.submitHandler) {
			this.form.removeEventListener('submit', this.submitHandler, true);
		}

		this.input?.remove();
		this.form = null;
		this.input = null;
		this.submitHandler = null;
	}
}
