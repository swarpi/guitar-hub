"use client";

import { useEffect, useState } from "react";

export function OfflineBanner(): React.ReactElement | null {
	const [offline, setOffline] = useState(false);

	useEffect(() => {
		setOffline(!navigator.onLine);

		const goOffline = () => setOffline(true);
		const goOnline = () => setOffline(false);

		window.addEventListener("offline", goOffline);
		window.addEventListener("online", goOnline);

		return () => {
			window.removeEventListener("offline", goOffline);
			window.removeEventListener("online", goOnline);
		};
	}, []);

	if (!offline) return null;

	return (
		<div
			role="status"
			className="bg-header px-4 py-2 text-center font-mono text-[11px] font-medium tracking-wide text-cream"
		>
			You are offline — viewing cached content
		</div>
	);
}
