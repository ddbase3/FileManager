import { FileManager, MemoryFileManagerAdapter } from '../../src/index.js';

const adapter = new MemoryFileManagerAdapter({
	items: [
		{
			id: 'dir_documents',
			name: 'Documents',
			path: 'Documents',
			kind: 'directory',
			modifiedAt: '2026-09-30T08:00:00Z'
		},
		{
			id: 'dir_images',
			name: 'Images',
			path: 'Images',
			kind: 'directory',
			modifiedAt: '2026-09-30T08:00:00Z'
		},
		{
			id: 'file_readme',
			name: 'README.txt',
			path: 'README.txt',
			kind: 'file',
			size: 4210,
			mimeType: 'text/plain',
			modifiedAt: '2026-09-30T08:30:00Z'
		},
		{
			id: 'file_report',
			name: 'report.pdf',
			path: 'Documents/report.pdf',
			kind: 'file',
			size: 845216,
			mimeType: 'application/pdf',
			modifiedAt: '2026-09-30T09:15:00Z'
		}
	]
});

const manager = new FileManager('#manager', {
	mode: 'container',
	adapter,
	rootPath: '',
	upload: {
		chunkSize: 1024 * 1024
	}
});

manager.init();
