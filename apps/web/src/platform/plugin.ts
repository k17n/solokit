import type { WebPlugin } from './PlatformProvider';

/**
 * The one place the public app looks for a plugin. It is `undefined` here, so the app is fully free.
 *
 * The private repo's build replaces this module (a bundler alias for `./plugin`) with one that exports its plugin, or
 * it loads the plugin at runtime from an authenticated URL and calls `registerPlatform` before the app renders.
 * Nothing in this repo imports from the private repo. See docs/extension-points.md.
 */
export const plugin: WebPlugin | undefined = undefined;
