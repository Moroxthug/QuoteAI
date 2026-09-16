import { cn } from "@/lib/utils";

interface RevealWord {
  text: string;
  gradient?: boolean;
}

/**
 * Renders a heading as lines of words that slide up + fade in with a
 * per-word stagger on mount (hero "word-reveal" animation, index.css'
 * .reveal-word-wrap/.reveal-word). Words carrying `gradient: true` get the
 * existing static .gradient-text treatment instead of solid color.
 */
export function RevealHeading({
  lines,
  className,
}: {
  lines: RevealWord[][];
  className?: string;
}) {
  let wordIndex = 0;
  return (
    <span className={className}>
      {lines.map((line, li) => (
        <span key={li} className="block">
          {line.map((word, wi) => {
            const delay = wordIndex++ * 0.06;
            return (
              <span key={wi} className="reveal-word-wrap">
                <span
                  className={cn("reveal-word", word.gradient && "gradient-text")}
                  style={{ animationDelay: `${delay}s` }}
                >
                  {word.text}
                  {wi < line.length - 1 ? " " : ""}
                </span>
              </span>
            );
          })}
        </span>
      ))}
    </span>
  );
}
