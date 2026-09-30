import { FileManager, MemoryFileManagerAdapter } from '../../src/index.js';

const form = document.querySelector('#articleForm');
const result = document.querySelector('#result');
const manager = new FileManager('#attachments', {
	mode: 'collection',
	adapter: new MemoryFileManagerAdapter(),
	form: {
		name: 'attachments'
	},
	upload: {
		chunkSize: 512 * 1024,
		maxParallelFiles: 2
	}
});

manager.init();

form.addEventListener('submit', (event) => {
	event.preventDefault();
	result.textContent = JSON.stringify(Object.fromEntries(new FormData(form).entries()), null, 2);
});
