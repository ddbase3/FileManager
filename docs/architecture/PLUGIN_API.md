# FileManager Plugin API

Plugins add optional behavior to a FileManager instance.

Core upload behavior, form binding and the three manager modes are not plugins.

## Plugin shape

A plugin is an object or factory with a unique `name`.

```javascript
export const ExamplePlugin = {
	name: 'example',
	install(context) {
		context.events.on('upload:completed', ({ item }) => {
			console.log(item);
		});
	},
	destroy(context) {
	}
};
```

A plugin may also provide commands:

```javascript
export const ExamplePlugin = {
	name: 'example',
	commands: {
		doSomething(context, payload) {
			return context.adapter.stat(payload.path);
		}
	}
};
```

## Plugin context

The context exposes:

- `manager`
- `store`
- `events`
- `commands`
- `queue`
- `adapter`
- `getState()`
- `setState()`
- `execute()`
- `requestRender()`
- `getOptions()`
- `getPluginOptions()`
- `getString()`

## Rules

Plugins must stay instance-local.

A plugin must not register global DOM state or replace the backend adapter contract.

A plugin should use events and commands before reaching into rendered DOM nodes.
