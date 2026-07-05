import type { Metadata } from "next";
import { Bevan, JetBrains_Mono, Spectral } from "next/font/google";
import "./globals.css";

const spectral = Spectral({
	variable: "--font-spectral",
	subsets: ["latin"],
	weight: ["300", "400", "500", "600"],
	style: ["normal", "italic"],
});

const jetbrainsMono = JetBrains_Mono({
	variable: "--font-jetbrains",
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
});

const bevan = Bevan({
	variable: "--font-bevan",
	subsets: ["latin"],
	weight: ["400"],
});

export const metadata: Metadata = {
	title: {
		default: "Music Hub",
		template: "%s — Music Hub",
	},
	description: "A personal music sheet and tablature collection",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="en"
			className={`${spectral.variable} ${jetbrainsMono.variable} ${bevan.variable}`}
		>
			<body className="min-h-screen bg-canvas font-serif text-ink">
				<div className="flex min-h-screen w-full items-start justify-center bg-canvas">
					<div className="relative min-h-screen w-full max-w-[720px] bg-page shadow-[0_0_0_1px_rgba(51,39,28,0.05),0_24px_70px_rgba(40,28,16,0.12)]">
						<div className="animate-[ghFade_.28s_ease_both]">{children}</div>
					</div>
				</div>
			</body>
		</html>
	);
}
