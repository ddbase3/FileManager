export class FileManagerPluginManager {
	constructor(context) {
		this.context = context;
		this.plugins = [];
	}

	install(plugins = []) {
		for (const pluginDefinition of plugins) {
			const plugin = this.normalizePlugin(pluginDefinition);

			if (!plugin || !plugin.name) {
				throw new Error('FileManager plugins require a unique name.');
			}

			if (this.plugins.some((installedPlugin) => installedPlugin.name === plugin.name)) {
				throw new Error(`FileManager plugin already installed: ${plugin.name}`);
			}

			this.installCommands(plugin);

			if (typeof plugin.install === 'function') {
				plugin.install(this.context);
			}

			this.plugins.push(plugin);
		}
	}

	normalizePlugin(pluginDefinition) {
		if (typeof pluginDefinition === 'function') {
			return pluginDefinition(this.context);
		}

		return pluginDefinition;
	}

	installCommands(plugin) {
		if (!plugin.commands) {
			return;
		}

		for (const [commandName, handler] of Object.entries(plugin.commands)) {
			this.context.commands.register(commandName, (payload) => handler(this.context, payload));
		}
	}

	destroy() {
		for (const plugin of [...this.plugins].reverse()) {
			if (typeof plugin.destroy === 'function') {
				plugin.destroy(this.context);
			}
		}

		this.plugins = [];
	}
}
