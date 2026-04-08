# Plugin Development

EmDash Astro Sidecar supports a plugin system for extending blog functionality.

## Plugin Structure

A plugin is a directory with:

```
my-plugin/
├── plugin.json      # Plugin manifest
└── src/
    └── index.ts     # Plugin entry point
```

## Plugin Manifest

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "0.1.0",
  "description": "A custom plugin",
  "author": "Your Name",
  "emdashVersion": ">=0.1.0-alpha",
  "main": "src/index.ts"
}
```

## Plugin Implementation

```typescript
import type { Plugin, PluginManifest, PluginContext } from '@emdash-astro-sidecar/plugins/sdk';

const manifest: PluginManifest = {
  id: 'my-plugin',
  name: 'My Plugin',
  version: '0.1.0',
  description: 'A custom plugin',
  emdashVersion: '>=0.1.0-alpha',
  main: 'src/index.ts',
};

export class MyPlugin implements Plugin {
  manifest = manifest;

  async init(ctx: PluginContext): Promise<void> {
    console.log('Plugin initialized');
  }

  async dispose(): Promise<void> {
    console.log('Plugin disposed');
  }
}

export function createPlugin(): Plugin {
  return new MyPlugin();
}
```

## Hooks

Plugins can register lifecycle hooks:

```typescript
import { hooks } from '@emdash-astro-sidecar/plugins/sdk';

hooks.register('post.afterRender', async (ctx) => {
  console.log('Post rendered!');
});
```

### Available Hooks

| Hook | Description |
|------|-------------|
| `post.beforeRender` | Before a post is rendered |
| `post.afterRender` | After a post is rendered |
| `post.beforeSave` | Before a post is saved |
| `post.afterSave` | After a post is saved |
| `build.before` | Before build starts |
| `build.after` | After build completes |
| `deploy.before` | Before deployment |
| `deploy.after` | After deployment |

## Plugin Registry

Register plugins in your Astro config:

```typescript
import { createRegistry } from '@emdash-astro-sidecar/plugins/sdk';

const registry = createRegistry();
await registry.register(myPlugin);
await registry.initialize(ctx);
```

## Best Practices

1. **Error Handling** - Always wrap hook handlers in try/catch
2. **Cleanup** - Dispose resources in `dispose()`
3. **Versioning** - Specify compatible EmDash version
4. **Testing** - Test hooks in isolation

## Example Plugins

See `packages/plugins/src/plugins/example-cta/` for a reference implementation.
