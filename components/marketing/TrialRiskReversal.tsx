/** Risk-reversal line under yellow trial CTAs. */
export default function TrialRiskReversal({
  tone = "dark",
  className = "",
}: {
  tone?: "dark" | "light" | "muted";
  className?: string;
}) {
  const colour =
    tone === "light"
      ? "text-white/50"
      : tone === "muted"
        ? "text-[#8b96a1]"
        : "text-[#5a6a78]";

  return (
    <p className={`font-sans text-[12.5px] leading-snug ${colour} ${className}`}>
      No credit card required · Setup takes 60 seconds
    </p>
  );
}
