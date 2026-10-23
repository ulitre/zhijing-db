import { Platform, Text } from "react-native";

export type IconName =
  | "target" | "spark" | "bolt" | "clock" | "layers" | "terminal" | "star"
  | "alert" | "check" | "radar" | "link" | "book" | "chart" | "shield" | "pen" | "arrow";

const ICON_FALLBACK: Record<IconName, string> = {
  target: "◎", spark: "✦", bolt: "⚡", clock: "◷", layers: "▤",
  terminal: "⌘", star: "✧", alert: "!", check: "✓", radar: "◈",
  link: "↳", book: "▤", chart: "◔", shield: "◇", pen: "✎", arrow: "→",
};

/** Hand-drawn 16px icon set: crisp SVG on web, a typographic fallback on native. */
export function MiniIcon({ name, size = 14, color }: { name: IconName; size?: number; color: string }) {
  if (Platform.OS !== "web") {
    return <Text style={{ color, fontSize: size, lineHeight: size + 2, fontWeight: "700" }}>{ICON_FALLBACK[name]}</Text>;
  }
  const common = { width: size, height: size, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true } as const;
  switch (name) {
    case "target":
      return <svg {...common}><circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.4" /><circle cx="8" cy="8" r="2.1" fill={color} /></svg>;
    case "spark":
      return <svg {...common}><path d="M8 1.4 9.7 6.3 14.6 8 9.7 9.7 8 14.6 6.3 9.7 1.4 8 6.3 6.3Z" fill={color} /></svg>;
    case "bolt":
      return <svg {...common}><path d="M9.1 1.5 3.6 9h3.3l-.8 5.5L12 6.6H8.7Z" fill={color} /></svg>;
    case "clock":
      return <svg {...common}><circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.4" /><path d="M8 4.4V8l2.5 1.6" stroke={color} strokeWidth="1.4" strokeLinecap="round" /></svg>;
    case "layers":
      return <svg {...common}><path d="m8 1.7 6 3.1-6 3.1-6-3.1Z" stroke={color} strokeWidth="1.3" strokeLinejoin="round" /><path d="m2.4 8.4 5.6 2.9 5.6-2.9M2.4 11.3l5.6 2.9 5.6-2.9" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case "terminal":
      return <svg {...common}><rect x="1.8" y="2.8" width="12.4" height="10.4" rx="2" stroke={color} strokeWidth="1.3" /><path d="m4.8 6.3 2 1.7-2 1.7M8.4 10h2.9" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case "star":
      return <svg {...common}><path d="m8 1.8 1.85 3.9 4.15.55-3.05 2.92.75 4.13L8 11.3l-3.7 2 .75-4.13L2 6.25l4.15-.55Z" stroke={color} strokeWidth="1.2" strokeLinejoin="round" /></svg>;
    case "alert":
      return <svg {...common}><path d="M8 2 14.2 13H1.8Z" stroke={color} strokeWidth="1.4" strokeLinejoin="round" /><path d="M8 6.2v3.1M8 11.2v.1" stroke={color} strokeWidth="1.5" strokeLinecap="round" /></svg>;
    case "check":
      return <svg {...common}><path d="m3 8.2 3.2 3.1L13 4.6" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case "link":
      return <svg {...common}><path d="m6.2 9.8 3.6-3.6" stroke={color} strokeWidth="1.3" strokeLinecap="round" /><path d="M7.1 12.2 5.6 13.7a2.7 2.7 0 0 1-3.8-3.8l2.2-2.2a2.7 2.7 0 0 1 3.8 0" stroke={color} strokeWidth="1.3" strokeLinecap="round" /><path d="M8.9 3.8 10.4 2.3a2.7 2.7 0 0 1 3.8 3.8l-2.2 2.2a2.7 2.7 0 0 1-3.8 0" stroke={color} strokeWidth="1.3" strokeLinecap="round" /></svg>;
    case "radar":
      return <svg {...common}><circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.3" opacity=".55" /><circle cx="8" cy="8" r="3.6" stroke={color} strokeWidth="1.2" opacity=".8" /><path d="M8 8 12.3 3.7" stroke={color} strokeWidth="1.4" strokeLinecap="round" /><circle cx="8" cy="8" r="1.5" fill={color} /></svg>;
    case "book":
      return <svg {...common}><path d="M2.5 3.2h3.9c.9 0 1.6.7 1.6 1.6v8.4c0-1-.7-1.7-1.7-1.7H2.5Z" stroke={color} strokeWidth="1.3" strokeLinejoin="round" /><path d="M13.5 3.2H9.6c-.9 0-1.6.7-1.6 1.6v8.4c0-1 .7-1.7 1.7-1.7h3.8Z" stroke={color} strokeWidth="1.3" strokeLinejoin="round" /></svg>;
    case "chart":
      return <svg {...common}><path d="M2.5 2.5v11h11" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /><path d="m4.6 10 2.9-3 2.2 2 2.8-3.3" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case "shield":
      return <svg {...common}><path d="M8 1.8 13 4v3.4c0 3.1-2 5.4-5 6.8-3-1.4-5-3.7-5-6.8V4Z" stroke={color} strokeWidth="1.3" strokeLinejoin="round" /><path d="m5.8 8 1.5 1.5 2.9-3" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case "pen":
      return <svg {...common}><path d="m3 13 1-3.5 7.2-7.2 2.5 2.5L6.5 12Z" stroke={color} strokeWidth="1.3" strokeLinejoin="round" /><path d="m9.7 3.6 2.7 2.7" stroke={color} strokeWidth="1.3" strokeLinecap="round" /></svg>;
    case "arrow":
      return <svg {...common}><path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    default:
      return <svg {...common}><path d="M8 1.6 13.7 8 8 14.4 2.3 8Z" stroke={color} strokeWidth="1.3" /><path d="M8 1.6v12.8M2.3 8h11.4" stroke={color} strokeWidth="1" opacity=".55" /></svg>;
  }
}
