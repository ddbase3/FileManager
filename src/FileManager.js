import { FileManagerEventBus } from './core/FileManagerEventBus.js';
import { FileManagerStateStore } from './core/FileManagerStateStore.js';
import { FileManagerCommandRegistry } from './core/FileManagerCommandRegistry.js';
import { FileManagerPluginManager } from './core/FileManagerPluginManager.js';
import { UploadQueue } from './core/UploadQueue.js';
import { FormBindingAdapter } from './adapters/FormBindingAdapter.js';
import { createFileManagerMode } from './modes/index.js';
import { clearElement, createButton, createElement, resolveElement } from './utils/dom.js';
import { baseName, fileMatchesAccept, formatBytes, joinPath, parentPath, splitPath } from './utils/files.js';
import { formatDateTime, formatString } from './utils/format.js';

const DEFAULT_STRINGS = {
	dropFiles: 'Drop files here',
	or: 'or',
	selectFile: 'Select file',
	selectFiles: 'Select files',
	uploading: 'Uploading',
	queued: 'Queued',
	finalizing: 'Finalizing',
	completed: 'Completed',
	failed: 'Failed',
	cancelled: 'Cancelled',
	cancel: 'Cancel',
	retry: 'Retry',
	remove: 'Remove',
	download: 'Download',
	refresh: 'Refresh',
	newFolder: 'New folder',
	rename: 'Rename',
	copy: 'Copy',
	move: 'Move',
	delete: 'Delete',
	up: 'Up',
	name: 'Name',
	size: 'Size',
	modified: 'Modified',
	noFiles: 'No files selected.',
	emptyDirectory: 'This folder is empty.',
	folderNamePrompt: 'Folder name',
	renamePrompt: 'New name',
	copyPrompt: 'Copy to folder',
	movePrompt: 'Move to folder',
	deleteConfirm: 'Delete the selected items?',
	loading: 'Loading...',
	fileTooLarge: 'File exceeds the maximum size of {size}.',
	fileTypeRejected: 'File type is not allowed.',
	maxFilesReached: 'The maximum number of files is {count}.',
	singleFileOnly: 'Single file mode accepts one file at a time.',
	invalidDescriptor: 'The backend returned an invalid file descriptor.'
};

const DEFAULT_OPTIONS = {
	mode: 'collection',
	adapter: null,
	initialItems: [],
	rootPath: '',
	path: '',
	containerId: '',
	uploadPath: '',
	deleteOnRemove: false,
	plugins: [],
	pluginOptions: {},
	strings: DEFAULT_STRINGS,
	form: null,
	onChange: null,
	upload: {
		accept: '',
		maxFileSize: null,
		maxFiles: null,
		chunkSize: 8 * 1024 * 1024,
		maxParallelFiles: 3,
		maxParallelChunks: 2,
		retryLimit: 3,
		retryDelayMs: 500,
		timeoutMs: 60000
	}
};

function mergeOptions(options = {}) {
	return {
		...DEFAULT_OPTIONS,
		...options,
		strings: {
			...DEFAULT_STRINGS,
			...(options.strings || {})
		},
		upload: {
			...DEFAULT_OPTIONS.upload,
			...(options.upload || {})
		}
	};
}

export class FileManager {
	constructor(target, options = {}) {
		this.target = resolveElement(target);
		this.options = mergeOptions(options);

		if (!this.target) {
			throw new Error('FileManager requires a DOM element or selector.');
		}

		if (!this.options.adapter) {
			throw new Error('FileManager requires an adapter.');
		}

		this.adapter = this.options.adapter;
		this.mode = createFileManagerMode(this.options.mode);
		this.events = new FileManagerEventBus();
		this.store = new FileManagerStateStore(this.createInitialState());
		this.commands = new FileManagerCommandRegistry();
		this.queue = new UploadQueue(this.adapter, this.events, this.options.upload);
		this.pluginManager = new FileManagerPluginManager(this.createPluginContext());
		this.root = null;
		this.fileInput = null;
		this.formBinding = null;
		this.singleUploadTaskId = null;
		this.unsubscribeState = null;
		this.eventDisposers = [];
		this.initialized = false;
		this.ready = Promise.resolve(this);
	}

	createInitialState() {
		return {
			items: this.mode.name === 'single'
				? this.normalizeInitialItems(this.options.initialItems).slice(0, 1)
				: this.normalizeInitialItems(this.options.initialItems),
			entries: [],
			selectedPaths: [],
			rootPath: this.options.rootPath || '',
			currentPath: this.options.path || this.options.rootPath || '',
			containerId: this.options.containerId || '',
			loading: false,
			error: ''
		};
	}

	createPluginContext() {
		return {
			manager: this,
			store: this.store,
			events: this.events,
			commands: this.commands,
			queue: this.queue,
			adapter: this.adapter,
			getState: () => this.getState(),
			setState: (patch) => this.setState(patch),
			execute: (commandName, payload) => this.execute(commandName, payload),
			requestRender: () => this.render(),
			getOptions: () => this.options,
			getPluginOptions: (pluginName) => this.getPluginOptions(pluginName),
			getString: (key, replacements = {}) => this.getString(key, replacements)
		};
	}

	init() {
		if (this.initialized) {
			return this;
		}

		this.root = createElement('div', {
			className: `fm-root fm-mode-${this.mode.name}`
		});
		this.target.appendChild(this.root);
		this.registerCoreCommands();
		this.bindCoreEvents();
		this.pluginManager.install(this.options.plugins);
		this.unsubscribeState = this.store.subscribe(() => this.render());
		this.initialized = true;
		this.render();

		if (this.options.form) {
			const formOptions = typeof this.options.form === 'object' ? this.options.form : {};
			this.formBinding = new FormBindingAdapter(this, formOptions).init();
		}

		if (this.mode.name === 'container') {
			this.ready = this.refresh().then(() => this);
		}

		return this;
	}

	registerCoreCommands() {
		this.commands.register('addFiles', (payload) => this.addFiles(payload?.files || payload));
		this.commands.register('cancelUpload', (payload) => this.queue.cancel(payload?.taskId || payload));
		this.commands.register('retryUpload', (payload) => this.queue.retry(payload?.taskId || payload));
		this.commands.register('removeUpload', (payload) => this.queue.remove(payload?.taskId || payload));
		this.commands.register('removeItem', (payload) => this.removeItem(payload?.item || payload));
		this.commands.register('refresh', () => this.refresh());
		this.commands.register('navigate', (payload) => this.navigate(payload?.path ?? payload));
		this.commands.register('mkdir', (payload) => this.createFolder(payload?.name ?? payload));
		this.commands.register('rename', (payload) => this.renameSelected(payload?.name ?? payload));
		this.commands.register('copy', (payload) => this.copySelected(payload?.targetPath ?? payload));
		this.commands.register('move', (payload) => this.moveSelected(payload?.targetPath ?? payload));
		this.commands.register('delete', () => this.deleteSelected());
		this.commands.register('select', (payload) => this.toggleSelection(payload?.path ?? payload));
		this.commands.register('clearSelection', () => this.clearSelection());
	}

	bindCoreEvents() {
		this.eventDisposers.push(this.events.on('queue:change', () => this.render()));
		this.eventDisposers.push(this.events.on('upload:completed', ({ task, item }) => {
			this.handleUploadCompleted(task, item);
		}));
		this.eventDisposers.push(this.events.on('upload:failed', ({ error }) => {
			this.setState({ error: error?.message || String(error) });
		}));
	}

	addFiles(files) {
		const incoming = Array.from(files || []);
		const normalized = this.mode.normalizeIncomingFiles(incoming);

		if (this.mode.name === 'single' && incoming.length > 1) {
			for (const rejectedFile of incoming.slice(1)) {
				this.rejectFile(rejectedFile, this.getString('singleFileOnly'));
			}
		}

		const accepted = [];
		for (const file of normalized) {
			const validationError = this.validateFile(file, accepted.length);

			if (validationError) {
				this.rejectFile(file, validationError);
				continue;
			}

			accepted.push(file);
		}

		if (accepted.length === 0) {
			return [];
		}

		this.setState({ error: '' });

		const previousSingleTasks = this.mode.name === 'single'
			? [...this.queue.getTasks()]
			: [];

		const path = this.mode.name === 'container'
			? this.getState().currentPath
			: this.options.uploadPath;
		const tasks = this.queue.add(accepted, { path });

		if (this.mode.name === 'single') {
			this.singleUploadTaskId = tasks[0]?.id || null;

			for (const task of previousSingleTasks) {
				if (['queued', 'uploading', 'finalizing'].includes(task.state)) {
					this.queue.cancel(task.id).catch(() => {});
					continue;
				}

				this.queue.remove(task.id).catch(() => {});
			}
		}

		for (const task of tasks) {
			this.events.emit('file:added', { file: task.file, task });
		}

		return tasks;
	}

	validateFile(file, additionalCount = 0) {
		const uploadOptions = this.options.upload;

		if (!fileMatchesAccept(file, uploadOptions.accept)) {
			return this.getString('fileTypeRejected');
		}

		if (uploadOptions.maxFileSize !== null && file.size > Number(uploadOptions.maxFileSize)) {
			return this.getString('fileTooLarge', {
				size: formatBytes(uploadOptions.maxFileSize)
			});
		}

		if (this.mode.name === 'collection' && uploadOptions.maxFiles !== null) {
			const pendingCount = this.queue.getTasks().filter((task) => {
				return ['queued', 'uploading', 'finalizing', 'failed', 'cancelled'].includes(task.state);
			}).length;
			const total = this.getState().items.length + pendingCount + additionalCount + 1;

			if (total > Number(uploadOptions.maxFiles)) {
				return this.getString('maxFilesReached', { count: uploadOptions.maxFiles });
			}
		}

		return '';
	}

	rejectFile(file, reason) {
		this.events.emit('file:rejected', { file, reason });
		this.setState({ error: reason });
	}

	handleUploadCompleted(task, item) {
		let descriptor;

		try {
			descriptor = this.normalizeDescriptor(item);
		} catch (error) {
			task.state = 'failed';
			task.error = error;
			this.events.emit('upload:failed', { task, error });
			return;
		}

		if (this.mode.name === 'single') {
			if (this.singleUploadTaskId && task.id !== this.singleUploadTaskId) {
				return;
			}

			this.setState({ items: [descriptor], error: '' });
			this.emitValueChange();
		} else if (this.mode.name === 'collection') {
			this.setState({
				items: [...this.getState().items, descriptor],
				error: ''
			});
			this.emitValueChange();
		} else {
			this.refresh().catch((error) => this.setState({ error: error.message }));
		}

		setTimeout(() => {
			this.queue.remove(task.id).catch(() => {});
		}, 1200);
	}

	async removeItem(item) {
		if (!item) {
			return;
		}

		if (this.options.deleteOnRemove && item.path) {
			await this.adapter.delete(item.path);
		}

		this.setState({
			items: this.getState().items.filter((candidate) => candidate.id !== item.id)
		});
		this.emitValueChange();
	}

	async refresh() {
		if (this.mode.name !== 'container') {
			return;
		}

		const path = this.getState().currentPath;
		this.setState({ loading: true, error: '' });

		try {
			const result = await this.adapter.list(path);

			if (!result || !Array.isArray(result.items)) {
				throw new Error('FileManager list response requires an items array.');
			}

			const entries = result.items.map((item) => this.normalizeDescriptor(item));
			this.setState({
				entries,
				containerId: result.containerId || this.getState().containerId,
				currentPath: result.path ?? path,
				selectedPaths: [],
				loading: false,
				error: ''
			});
			this.emitValueChange();
			this.events.emit('directory:change', {
				path: result.path ?? path,
				entries
			});
		} catch (error) {
			this.setState({
				loading: false,
				error: error?.message || String(error)
			});
			throw error;
		}
	}

	async navigate(path) {
		if (this.mode.name !== 'container') {
			return;
		}

		this.setState({
			currentPath: String(path || ''),
			selectedPaths: []
		});
		await this.refresh();
	}

	async createFolder(name) {
		if (this.mode.name !== 'container' || !name) {
			return;
		}

		await this.adapter.mkdir(joinPath(this.getState().currentPath, name));
		await this.refresh();
	}

	async renameSelected(name) {
		const selected = this.getSelectedEntries();

		if (this.mode.name !== 'container' || selected.length !== 1 || !name) {
			return;
		}

		const source = selected[0];
		const targetPath = joinPath(parentPath(source.path), name);
		await this.adapter.move(source.path, targetPath);
		await this.refresh();
	}

	async copySelected(targetDirectory) {
		const selected = this.getSelectedEntries();

		if (this.mode.name !== 'container' || selected.length === 0 || targetDirectory === null || targetDirectory === undefined) {
			return;
		}

		for (const item of selected) {
			await this.adapter.copy(item.path, joinPath(targetDirectory, item.name));
		}

		await this.refresh();
	}

	async moveSelected(targetDirectory) {
		const selected = this.getSelectedEntries();

		if (this.mode.name !== 'container' || selected.length === 0 || targetDirectory === null || targetDirectory === undefined) {
			return;
		}

		for (const item of selected) {
			await this.adapter.move(item.path, joinPath(targetDirectory, item.name));
		}

		await this.refresh();
	}

	async deleteSelected() {
		const selected = this.getSelectedEntries();

		if (this.mode.name !== 'container' || selected.length === 0) {
			return;
		}

		for (const item of selected) {
			if (item.kind === 'directory') {
				await this.adapter.rmdir(item.path);
			} else {
				await this.adapter.delete(item.path);
			}
		}

		await this.refresh();
	}

	toggleSelection(path) {
		const selected = new Set(this.getState().selectedPaths);

		if (selected.has(path)) {
			selected.delete(path);
		} else {
			selected.add(path);
		}

		const selectedPaths = [...selected];
		this.setState({ selectedPaths });
		this.events.emit('selection:change', {
			paths: selectedPaths,
			items: this.getSelectedEntries(selectedPaths)
		});
	}

	clearSelection() {
		this.setState({ selectedPaths: [] });
		this.events.emit('selection:change', { paths: [], items: [] });
	}

	getSelectedEntries(selectedPaths = this.getState().selectedPaths) {
		const selected = new Set(selectedPaths);
		return this.getState().entries.filter((item) => selected.has(item.path));
	}

	getValue() {
		return this.mode.getValue(this.getState());
	}

	getItems() {
		return [...this.getState().items];
	}

	setItems(items) {
		if (this.mode.name === 'container') {
			throw new Error('setItems() is only available in single and collection modes.');
		}

		const normalized = this.normalizeInitialItems(items);
		this.setState({
			items: this.mode.name === 'single' ? normalized.slice(0, 1) : normalized
		});
		this.emitValueChange();
	}

	hasPendingUploads() {
		return this.queue.hasPending();
	}

	hasFailedUploads() {
		return this.queue.hasFailed();
	}

	waitForUploads() {
		return this.queue.waitForIdle({ rejectOnFailed: true });
	}

	on(eventName, handler) {
		return this.events.on(eventName, handler);
	}

	off(eventName, handler) {
		this.events.off(eventName, handler);
	}

	execute(commandName, payload) {
		return this.commands.execute(commandName, payload);
	}

	getState() {
		return this.store.getState();
	}

	setState(patch) {
		this.store.setState(patch);
	}

	getPluginOptions(pluginName) {
		return this.options.pluginOptions?.[pluginName] || {};
	}

	getString(key, replacements = {}) {
		return formatString(this.options.strings[key] ?? key, replacements);
	}

	emitValueChange() {
		const payload = {
			value: this.getValue(),
			items: this.getItems(),
			manager: this
		};
		this.events.emit('value:change', payload);

		if (typeof this.options.onChange === 'function') {
			this.options.onChange(payload.value, payload);
		}
	}

	normalizeInitialItems(items) {
		return Array.from(items || []).map((item) => this.normalizeDescriptor(item));
	}

	normalizeDescriptor(item) {
		if (!item || !item.id || !item.name || item.path === undefined || !['file', 'directory'].includes(item.kind)) {
			throw new Error(this.getString?.('invalidDescriptor') || DEFAULT_STRINGS.invalidDescriptor);
		}

		return {
			id: String(item.id),
			name: String(item.name),
			path: String(item.path),
			kind: item.kind,
			size: item.size === undefined || item.size === null ? null : Number(item.size),
			mimeType: item.mimeType || '',
			modifiedAt: item.modifiedAt || '',
			metadata: item.metadata || null
		};
	}

	render() {
		if (!this.root) {
			return;
		}

		clearElement(this.root);
		this.root.appendChild(this.renderDropZone());

		if (this.mode.name === 'container') {
			this.root.appendChild(this.renderContainer());
		} else {
			this.root.appendChild(this.renderItems());
		}

		const queue = this.renderQueue();
		if (queue) {
			this.root.appendChild(queue);
		}

		if (this.getState().error) {
			this.root.appendChild(createElement('div', {
				className: 'fm-error',
				text: this.getState().error,
				attrs: { role: 'alert' }
			}));
		}
	}

	renderDropZone() {
		const dropZone = createElement('div', {
			className: 'fm-dropzone',
			attrs: {
				tabindex: '0',
				role: 'button'
			}
		});
		const title = createElement('div', {
			className: 'fm-dropzone-title',
			text: this.getString('dropFiles')
		});
		const separator = createElement('span', {
			className: 'fm-dropzone-separator',
			text: this.getString('or')
		});
		const button = createButton({
			className: 'fm-button fm-primary-button',
			text: this.mode.name === 'single' ? this.getString('selectFile') : this.getString('selectFiles'),
			onClick: () => this.fileInput?.click()
		});
		this.fileInput = createElement('input', {
			className: 'fm-file-input',
			attrs: {
				type: 'file',
				multiple: this.mode.name !== 'single',
				accept: this.options.upload.accept || undefined
			}
		});
		this.fileInput.addEventListener('change', () => {
			this.addFiles(this.fileInput.files);
			this.fileInput.value = '';
		});

		dropZone.append(title, separator, button, this.fileInput);
		dropZone.addEventListener('click', (event) => {
			if (event.target === dropZone || event.target === title || event.target === separator) {
				this.fileInput?.click();
			}
		});
		dropZone.addEventListener('keydown', (event) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				this.fileInput?.click();
			}
		});
		dropZone.addEventListener('dragenter', (event) => {
			event.preventDefault();
			dropZone.classList.add('fm-dropzone-active');
		});
		dropZone.addEventListener('dragover', (event) => {
			event.preventDefault();
			dropZone.classList.add('fm-dropzone-active');
		});
		dropZone.addEventListener('dragleave', (event) => {
			if (!dropZone.contains(event.relatedTarget)) {
				dropZone.classList.remove('fm-dropzone-active');
			}
		});
		dropZone.addEventListener('drop', (event) => {
			event.preventDefault();
			dropZone.classList.remove('fm-dropzone-active');
			this.addFiles(event.dataTransfer?.files || []);
		});

		return dropZone;
	}

	renderItems() {
		const container = createElement('div', { className: 'fm-items' });
		const items = this.getState().items;

		if (items.length === 0) {
			container.appendChild(createElement('div', {
				className: 'fm-empty',
				text: this.getString('noFiles')
			}));
			return container;
		}

		for (const item of items) {
			container.appendChild(this.renderFileItem(item));
		}

		return container;
	}

	renderFileItem(item) {
		const row = createElement('div', { className: 'fm-item' });
		const main = createElement('div', { className: 'fm-item-main' });
		main.appendChild(createElement('div', {
			className: 'fm-item-name',
			text: item.name
		}));
		main.appendChild(createElement('div', {
			className: 'fm-item-meta',
			text: item.size === null ? '' : formatBytes(item.size)
		}));
		const actions = createElement('div', { className: 'fm-item-actions' });
		const downloadUrl = item.path ? this.adapter.getDownloadUrl(item.path) : '';

		if (downloadUrl) {
			const download = createElement('a', {
				className: 'fm-button fm-link-button',
				text: this.getString('download'),
				attrs: {
					href: downloadUrl,
					target: '_blank',
					rel: 'noopener'
				}
			});
			actions.appendChild(download);
		}

		actions.appendChild(createButton({
			text: this.getString('remove'),
			onClick: () => this.removeItem(item).catch((error) => this.setState({ error: error.message }))
		}));
		row.append(main, actions);
		return row;
	}

	renderQueue() {
		const tasks = this.queue.getTasks();

		if (tasks.length === 0) {
			return null;
		}

		const container = createElement('div', { className: 'fm-upload-list' });

		for (const task of tasks) {
			const row = createElement('div', {
				className: `fm-upload fm-upload-${task.state}`
			});
			const header = createElement('div', { className: 'fm-upload-header' });
			const info = createElement('div', { className: 'fm-upload-info' });
			info.appendChild(createElement('div', {
				className: 'fm-upload-name',
				text: task.file.name
			}));
			info.appendChild(createElement('div', {
				className: 'fm-upload-meta',
				text: `${formatBytes(task.file.size)} - ${this.getString(task.state)}`
			}));
			const actions = createElement('div', { className: 'fm-upload-actions' });

			if (['queued', 'uploading', 'finalizing'].includes(task.state)) {
				actions.appendChild(createButton({
					text: this.getString('cancel'),
					onClick: () => this.queue.cancel(task.id).catch((error) => this.setState({ error: error.message }))
				}));
			}

			if (['failed', 'cancelled'].includes(task.state)) {
				actions.appendChild(createButton({
					text: this.getString('retry'),
					onClick: () => this.queue.retry(task.id)
				}));
				actions.appendChild(createButton({
					text: this.getString('remove'),
					onClick: () => this.queue.remove(task.id).catch((error) => this.setState({ error: error.message }))
				}));
			}

			header.append(info, actions);
			const progress = createElement('div', {
				className: 'fm-progress',
				attrs: {
					role: 'progressbar',
					'aria-valuemin': '0',
					'aria-valuemax': '100',
					'aria-valuenow': String(Math.round(task.progress * 100))
				}
			});
			progress.appendChild(createElement('div', {
				className: 'fm-progress-bar',
				attrs: {
					style: `width: ${Math.round(task.progress * 100)}%`
				}
			}));
			row.append(header, progress);

			if (task.error) {
				row.appendChild(createElement('div', {
					className: 'fm-upload-error',
					text: task.error.message || String(task.error)
				}));
			}

			container.appendChild(row);
		}

		return container;
	}

	renderContainer() {
		const container = createElement('div', { className: 'fm-container' });
		container.appendChild(this.renderContainerToolbar());
		container.appendChild(this.renderBreadcrumbs());

		if (this.getState().loading) {
			container.appendChild(createElement('div', {
				className: 'fm-empty',
				text: this.getString('loading')
			}));
			return container;
		}

		container.appendChild(this.renderDirectoryTable());
		return container;
	}

	renderContainerToolbar() {
		const toolbar = createElement('div', { className: 'fm-toolbar' });
		const selected = this.getSelectedEntries();
		const atRoot = this.getState().currentPath === this.getState().rootPath;
		toolbar.appendChild(createButton({
			text: this.getString('up'),
			disabled: atRoot,
			onClick: () => this.navigate(parentPath(this.getState().currentPath)).catch((error) => this.setState({ error: error.message }))
		}));
		toolbar.appendChild(createButton({
			text: this.getString('refresh'),
			onClick: () => this.refresh().catch((error) => this.setState({ error: error.message }))
		}));
		toolbar.appendChild(createButton({
			text: this.getString('newFolder'),
			onClick: () => {
				const name = window.prompt(this.getString('folderNamePrompt'), '');
				if (name) {
					this.createFolder(name).catch((error) => this.setState({ error: error.message }));
				}
			}
		}));
		toolbar.appendChild(createButton({
			text: this.getString('rename'),
			disabled: selected.length !== 1,
			onClick: () => {
				const name = window.prompt(this.getString('renamePrompt'), selected[0]?.name || '');
				if (name && name !== selected[0]?.name) {
					this.renameSelected(name).catch((error) => this.setState({ error: error.message }));
				}
			}
		}));
		toolbar.appendChild(createButton({
			text: this.getString('copy'),
			disabled: selected.length === 0,
			onClick: () => {
				const targetPath = window.prompt(this.getString('copyPrompt'), this.getState().currentPath);
				if (targetPath !== null) {
					this.copySelected(targetPath).catch((error) => this.setState({ error: error.message }));
				}
			}
		}));
		toolbar.appendChild(createButton({
			text: this.getString('move'),
			disabled: selected.length === 0,
			onClick: () => {
				const targetPath = window.prompt(this.getString('movePrompt'), this.getState().currentPath);
				if (targetPath !== null) {
					this.moveSelected(targetPath).catch((error) => this.setState({ error: error.message }));
				}
			}
		}));
		toolbar.appendChild(createButton({
			text: this.getString('delete'),
			disabled: selected.length === 0,
			onClick: () => {
				if (window.confirm(this.getString('deleteConfirm'))) {
					this.deleteSelected().catch((error) => this.setState({ error: error.message }));
				}
			}
		}));
		return toolbar;
	}

	renderBreadcrumbs() {
		const breadcrumbs = createElement('nav', {
			className: 'fm-breadcrumbs',
			attrs: { 'aria-label': 'File path' }
		});
		const rootPath = this.getState().rootPath;
		const currentPath = this.getState().currentPath;
		const rootName = baseName(rootPath) || '/';
		breadcrumbs.appendChild(createButton({
			className: 'fm-breadcrumb',
			text: rootName,
			disabled: currentPath === rootPath,
			onClick: () => this.navigate(rootPath).catch((error) => this.setState({ error: error.message }))
		}));

		let accumulated = rootPath;
		const rootSegments = splitPath(rootPath).length;
		const segments = splitPath(currentPath).slice(rootSegments);

		for (const segment of segments) {
			accumulated = joinPath(accumulated, segment);
			breadcrumbs.appendChild(createElement('span', {
				className: 'fm-breadcrumb-separator',
				text: '/'
			}));
			const path = accumulated;
			breadcrumbs.appendChild(createButton({
				className: 'fm-breadcrumb',
				text: segment,
				disabled: path === currentPath,
				onClick: () => this.navigate(path).catch((error) => this.setState({ error: error.message }))
			}));
		}

		return breadcrumbs;
	}

	renderDirectoryTable() {
		const entries = [...this.getState().entries].sort((left, right) => {
			if (left.kind !== right.kind) {
				return left.kind === 'directory' ? -1 : 1;
			}

			return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
		});
		const wrapper = createElement('div', { className: 'fm-table-wrapper' });
		const table = createElement('table', { className: 'fm-table' });
		const thead = createElement('thead');
		const headRow = createElement('tr');
		headRow.append(
			createElement('th', { className: 'fm-select-column' }),
			createElement('th', { text: this.getString('name') }),
			createElement('th', { text: this.getString('size') }),
			createElement('th', { text: this.getString('modified') })
		);
		thead.appendChild(headRow);
		table.appendChild(thead);
		const tbody = createElement('tbody');

		if (entries.length === 0) {
			const row = createElement('tr');
			row.appendChild(createElement('td', {
				className: 'fm-empty-cell',
				text: this.getString('emptyDirectory'),
				attrs: { colspan: '4' }
			}));
			tbody.appendChild(row);
		}

		for (const item of entries) {
			tbody.appendChild(this.renderDirectoryRow(item));
		}

		table.appendChild(tbody);
		wrapper.appendChild(table);
		return wrapper;
	}

	renderDirectoryRow(item) {
		const row = createElement('tr', {
			className: this.getState().selectedPaths.includes(item.path) ? 'fm-row-selected' : ''
		});
		const selectCell = createElement('td', { className: 'fm-select-column' });
		const checkbox = createElement('input', {
			attrs: {
				type: 'checkbox',
				'aria-label': `Select ${item.name}`
			}
		});
		checkbox.checked = this.getState().selectedPaths.includes(item.path);
		checkbox.addEventListener('change', () => this.toggleSelection(item.path));
		selectCell.appendChild(checkbox);
		const nameCell = createElement('td');

		if (item.kind === 'directory') {
			nameCell.appendChild(createButton({
				className: 'fm-entry-name fm-entry-directory',
				text: item.name,
				onClick: () => this.navigate(item.path).catch((error) => this.setState({ error: error.message }))
			}));
		} else {
			const downloadUrl = this.adapter.getDownloadUrl(item.path);
			if (downloadUrl) {
				nameCell.appendChild(createElement('a', {
					className: 'fm-entry-name fm-entry-file',
					text: item.name,
					attrs: {
						href: downloadUrl,
						target: '_blank',
						rel: 'noopener'
					}
				}));
			} else {
				nameCell.appendChild(createElement('span', {
					className: 'fm-entry-name fm-entry-file',
					text: item.name
				}));
			}
		}

		row.append(
			selectCell,
			nameCell,
			createElement('td', { text: item.kind === 'file' && item.size !== null ? formatBytes(item.size) : '' }),
			createElement('td', { text: formatDateTime(item.modifiedAt) })
		);
		return row;
	}

	destroy() {
		if (!this.initialized) {
			return;
		}

		for (const task of this.queue.getTasks()) {
			if (['queued', 'uploading', 'finalizing'].includes(task.state)) {
				this.queue.cancel(task.id).catch(() => {});
			}
		}

		this.formBinding?.destroy();
		this.pluginManager.destroy();
		this.unsubscribeState?.();

		for (const dispose of this.eventDisposers) {
			dispose();
		}

		this.eventDisposers = [];
		this.events.clear();
		this.commands.clear();
		this.root?.remove();
		this.root = null;
		this.fileInput = null;
		this.initialized = false;
	}
}
