import { FileManager, MemoryFileManagerAdapter } from '../../src/index.js';

function delay(milliseconds) {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

class SlowMemoryAdapter extends MemoryFileManagerAdapter {
	async uploadChunk(chunk) {
		for (let step = 1; step <= 5; step += 1) {
			if (chunk.signal?.aborted) {
				const error = new Error('Upload aborted.');
				error.name = 'AbortError';
				throw error;
			}

			await delay(80);
			chunk.onProgress?.(Math.round(chunk.size * step / 5), chunk.size);
		}

		return super.uploadChunk({
			...chunk,
			onProgress: null
		});
	}
}

const events = document.querySelector('#events');
const manager = new FileManager('#manager', {
	mode: 'collection',
	adapter: new SlowMemoryAdapter(),
	upload: {
		chunkSize: 1024 * 1024,
		maxParallelFiles: 2,
		maxParallelChunks: 3,
		retryLimit: 3
	}
});

manager.on('upload:retry', ({ task, index, attempt }) => {
	events.textContent += `Retry ${task.file.name} chunk ${index}, attempt ${attempt}\n`;
});
manager.on('upload:completed', ({ task }) => {
	events.textContent += `Completed ${task.file.name}\n`;
});
manager.init();
