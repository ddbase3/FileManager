# FileManager Plugins

Optional FileManager plugins live in this directory.

The core already exposes the plugin manager, command registry, event bus, state store, upload queue and adapter through the plugin context. Add a plugin only when behavior is optional. Core file selection, drag and drop, upload queueing, chunking, form binding and the three manager modes are not plugins.
