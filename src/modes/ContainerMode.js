export class ContainerMode {
	constructor() {
		this.name = 'container';
	}

	normalizeIncomingFiles(files) {
		return Array.from(files || []);
	}

	getValue(state) {
		return state.containerId || state.rootPath || '';
	}
}
