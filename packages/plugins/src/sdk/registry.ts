import type { Plugin, PluginRegistry as PluginRegistryType, HookContext, RenderContext, PublishContext } from './types.js';

const plugins: Map<string, Plugin> = new Map();

export const pluginRegistry: PluginRegistryType = {
  register(plugin: Plugin) {
    if (plugins.has(plugin.name)) {
      console.warn(`Plugin '${plugin.name}' already registered, skipping.`);
      return;
    }
    plugins.set(plugin.name, plugin);
    console.log(`Plugin '${plugin.name}' v${plugin.version} registered.`);
  },

  unregister(name: string) {
    plugins.delete(name);
    console.log(`Plugin '${name}' unregistered.`);
  },

  get(name: string) {
    return plugins.get(name);
  },

  list() {
    return Array.from(plugins.values());
  },

  enabled() {
    return Array.from(plugins.values()).filter(p => p.enabled !== false);
  },
};

// Hook execution helpers
export async function runOnInit(ctx: HookContext) {
  for (const plugin of pluginRegistry.enabled()) {
    if (plugin.hooks?.onInit) {
      try {
        await plugin.hooks.onInit(ctx);
      } catch (err) {
        ctx.logger.error(`[${plugin.name}] onInit failed: ${err}`);
      }
    }
  }
}

export async function runOnBuild(ctx: HookContext) {
  for (const plugin of pluginRegistry.enabled()) {
    if (plugin.hooks?.onBuild) {
      try {
        await plugin.hooks.onBuild(ctx);
      } catch (err) {
        ctx.logger.error(`[${plugin.name}] onBuild failed: ${err}`);
      }
    }
  }
}

export async function runOnRender(ctx: RenderContext): Promise<string> {
  let html = '';
  for (const plugin of pluginRegistry.enabled()) {
    if (plugin.hooks?.onRender) {
      try {
        html = await plugin.hooks.onRender(ctx);
      } catch (err) {
        ctx.logger.error(`[${plugin.name}] onRender failed: ${err}`);
      }
    }
  }
  return html;
}

export async function runOnPublish(ctx: PublishContext) {
  for (const plugin of pluginRegistry.enabled()) {
    if (plugin.hooks?.onPublish) {
      try {
        await plugin.hooks.onPublish(ctx);
      } catch (err) {
        ctx.logger.error(`[${plugin.name}] onPublish failed: ${err}`);
      }
    }
  }
}

export { pluginRegistry as registry };
