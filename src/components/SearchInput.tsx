"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

export function SearchInput(): React.ReactElement {
	const searchParams = useSearchParams();
	const router = useRouter();
	const pathname = usePathname();
	const [, startTransition] = useTransition();
	const [value, setValue] = useState(searchParams.get("q") ?? "");

	function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
		const next = e.target.value;
		setValue(next);
		startTransition(() => {
			const params = new URLSearchParams(searchParams);
			if (next) {
				params.set("q", next);
			} else {
				params.delete("q");
			}
			router.replace(`${pathname}?${params.toString()}`);
		});
	}

	return (
		<input
			type="text"
			value={value}
			onChange={handleChange}
			placeholder="Search songs or artists…"
			className="w-full rounded-lg border border-white/20 bg-white/[.08] px-3.5 py-[11px] font-serif text-[15.5px] text-[#eef2e9] placeholder-[rgba(232,236,222,0.5)] focus:border-white/50 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.12)] focus:outline-none"
		/>
	);
}
