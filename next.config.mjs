if (process.env.NODE_ENV === "development") {
	const { setupDevPlatform } = await import(
		"@cloudflare/next-on-pages/next-dev"
	);
	await setupDevPlatform();
}

/** @type {import('next').NextConfig} */
const nextConfig = {
	async redirects() {
		return [
			{
				source: "/artists/:artistSlug",
				destination: "/guitar/:artistSlug",
				permanent: true,
			},
			{
				source: "/artists/:artistSlug/:songSlug",
				destination: "/guitar/:artistSlug/:songSlug",
				permanent: true,
			},
			{
				source: "/add",
				destination: "/guitar/add",
				permanent: true,
			},
			{
				source: "/edit/:songId",
				destination: "/guitar/edit/:songId",
				permanent: true,
			},
		];
	},
};

export default nextConfig;
