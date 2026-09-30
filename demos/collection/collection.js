import { FileManager, MemoryFileManagerAdapter } from '../../src/index.js';

const value = document.querySelector('#value');
const manager = new FileManager('#manager', {
	mode: 'collection',
	adapter: new MemoryFileManagerAdapter(),
	upload: {
		accept: '.pdf,image/*',
		maxFiles: 10,
		chunkSize: 1024 * 1024,
		maxParallelFiles: 2,
		maxParallelChunks: 2
	},
	onChange(currentValue) {
		value.textContent = JSON.stringify(currentValue, null, 2);
	}
});

manager.init();
value.textContent = JSON.stringify(manager.getValue(), null, 2);
