import { SingleFileMode } from './SingleFileMode.js';
import { CollectionMode } from './CollectionMode.js';
import { ContainerMode } from './ContainerMode.js';

export function createFileManagerMode(name) {
	switch (name) {
		case 'single':
			return new SingleFileMode();
		case 'collection':
			return new CollectionMode();
		case 'container':
			return new ContainerMode();
		default:
			throw new Error(`Unsupported FileManager mode: ${name}`);
	}
}

export { SingleFileMode } from './SingleFileMode.js';
export { CollectionMode } from './CollectionMode.js';
export { ContainerMode } from './ContainerMode.js';
