export class FileManagerStateStore {
	constructor(initialState = {}) {
		this.state = { ...initialState };
		this.listeners = new Set();
	}

	getState() {
		return this.state;
	}

	setState(patch) {
		this.state = {
			...this.state,
			...patch
		};

		this.notify();
	}

	update(updater) {
		this.setState(updater(this.state));
	}

	subscribe(listener) {
		this.listeners.add(listener);

		return () => this.listeners.delete(listener);
	}

	notify() {
		for (const listener of this.listeners) {
			listener(this.state);
		}
	}
}
