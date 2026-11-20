import { RANK_CHARS, SUIT_CHARS, rankOf, suitOf, type Card } from "@/poker/cards";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "h-9 w-[26px] text-[11px]",
  md: "h-14 w-10 text-sm",
  lg: "h-20 w-14 text-lg",
};

export function PlayingCard({
  card,
  hidden,
  size = "md",
  dim,
  highlight,
}: {
  card?: Card;
  hidden?: boolean;
  size?: keyof typeof SIZES;
  dim?: boolean;
  highlight?: boolean;
}) {
  if (hidden || card === undefined) {
    return (
      <div
        className={cn(
          SIZES[size],
          "rounded-md border border-white/30 shadow-md",
          "bg-[repeating-linear-gradient(45deg,#7f1d1d_0_4px,#991b1b_4px_8px)]",
        )}
        aria-label="verdeckte Karte"
      />
    );
  }
  const red = suitOf(card) === 1 || suitOf(card) === 2;
  const rank = RANK_CHARS[rankOf(card)].replace("T", "10");
  return (
    <div
      className={cn(
        SIZES[size],
        "relative flex flex-col items-center justify-center rounded-md border bg-white font-semibold leading-none shadow-md select-none",
        red ? "text-red-600" : "text-zinc-900",
        dim && "opacity-40",
        highlight ? "border-amber-400 ring-2 ring-amber-400" : "border-zinc-300",
      )}
      aria-label={`${rank}${SUIT_CHARS[suitOf(card)]}`}
    >
      <span>{rank}</span>
      <span className={size === "sm" ? "text-[12px]" : size === "md" ? "text-lg" : "text-2xl"}>
        {SUIT_CHARS[suitOf(card)]}
      </span>
    </div>
  );
}
