export class SingleFileMode {
	constructor() {
		this.name = 'single';
	}

	normalizeIncomingFiles(files) {
		return Array.from(files || []).slice(0, 1);
	}

	getValue(state) {
		return state.items[0]?.id || '';
	}
}
