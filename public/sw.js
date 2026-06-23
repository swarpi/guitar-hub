importScripts(
	"https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js",
);

const CACHE_VERSION = "v1";
const PAGES_CACHE = `pages-${CACHE_VERSION}`;
const ASSETS_CACHE = `assets-${CACHE_VERSION}`;
const VALID_CACHES = [PAGES_CACHE, ASSETS_CACHE];

workbox.routing.registerRoute(
	({ request }) => request.mode === "navigate",
	new workbox.strategies.NetworkFirst({
		cacheName: PAGES_CACHE,
		plugins: [
			new workbox.expiration.ExpirationPlugin({
				maxEntries: 50,
			}),
		],
	}),
);

workbox.routing.registerRoute(
	({ request }) =>
		request.destination === "script" ||
		request.destination === "style" ||
		request.destination === "font" ||
		request.destination === "image",
	new workbox.strategies.CacheFirst({
		cacheName: ASSETS_CACHE,
		plugins: [
			new workbox.expiration.ExpirationPlugin({
				maxEntries: 100,
				maxAgeSeconds: 30 * 24 * 60 * 60,
			}),
		],
	}),
);

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches.keys().then((keys) =>
			Promise.all(
				keys
					.filter((key) => !VALID_CACHES.includes(key))
					.map((key) => caches.delete(key)),
			),
		),
	);
});
