export class CollectionMode {
	constructor() {
		this.name = 'collection';
	}

	normalizeIncomingFiles(files) {
		return Array.from(files || []);
	}

	getValue(state) {
		return state.items.map((item) => item.id).filter(Boolean);
	}
}
