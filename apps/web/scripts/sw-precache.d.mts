export function collectUrls(relativeFiles: string[]): string[];
export function buildId(entries: { url: string; hash: string }[]): string;
export function injectPrecache(source: string, id: string, urls: string[]): string;
