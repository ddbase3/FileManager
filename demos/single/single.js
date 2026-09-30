import { FileManager, MemoryFileManagerAdapter } from '../../src/index.js';

const value = document.querySelector('#value');
const adapter = new MemoryFileManagerAdapter();
const manager = new FileManager('#manager', {
	mode: 'single',
	adapter,
	upload: {
		chunkSize: 1024 * 1024
	},
	onChange(currentValue) {
		value.textContent = JSON.stringify(currentValue, null, 2);
	}
});

manager.init();
value.textContent = JSON.stringify(manager.getValue(), null, 2);
