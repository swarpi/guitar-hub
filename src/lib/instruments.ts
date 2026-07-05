import { notFound } from "next/navigation";

export const INSTRUMENTS = ["guitar", "piano"] as const;

export type Instrument = (typeof INSTRUMENTS)[number];

export function isInstrument(value: string): value is Instrument {
	return (INSTRUMENTS as readonly string[]).includes(value);
}

export function assertInstrument(value: string): Instrument {
	if (!isInstrument(value)) notFound();
	return value;
}

export const INSTRUMENT_LABELS: Record<Instrument, string> = {
	guitar: "Guitar",
	piano: "Piano",
};
