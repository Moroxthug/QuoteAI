import { cn } from "@/lib/utils";

// Phase 91: a person's photo, or their initials when they have none.

function initialsOf(name: string | null | undefined, fallback = "?"): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return fallback;
  return (words.length === 1 ? words[0]!.slice(0, 2) : `${words[0]![0]}${words[words.length - 1]![0]}`).toUpperCase();
}

export function PersonAvatar({ name, image, size = 34, className }: { name: string | null | undefined; image?: string | null; size?: number; className?: string }) {
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.36)) };
  if (image) return <img src={image} alt="" className={cn("avat", className)} style={{ ...style, objectFit: "cover" }} />;
  return <span className={cn("avat", className)} style={style} aria-hidden="true">{initialsOf(name)}</span>;
}
