import Image from "next/image";

export default function FinnhubBadge() {
  return (
    <span className="border border-positive px-1.5 py-0.5 rounded flex items-center gap-1">
      <Image
        src="/finnhub-logo.png"
        alt="Finnhub"
        width={12}
        height={12}
        style={{ width: 12, height: "auto" }}
        className="object-contain"
      />
      <span className="text-positive font-bold">Finnhub</span>
    </span>
  );
}
