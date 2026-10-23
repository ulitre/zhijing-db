import { useCallback, useEffect, useState, type PropsWithChildren } from "react";
import { Platform, View, type StyleProp, type ViewProps, type ViewStyle } from "react-native";

export type RevealDirection = "up" | "left" | "right";

export function useScrollReveal(reducedMotion = false) {
  const [node, setNode] = useState<View | null>(null);
  const [revealed, setRevealed] = useState(Platform.OS !== "web");
  const ref = useCallback((instance: View | null) => setNode(instance), []);

  useEffect(() => {
    if (Platform.OS !== "web" || reducedMotion || !node) return;
    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setRevealed(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setRevealed(true);
        observer.disconnect();
      }
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    observer.observe(node as unknown as Element);
    return () => observer.disconnect();
  }, [node, reducedMotion]);

  return { ref, visible: reducedMotion || revealed };
}

export function revealData(visible: boolean, direction: RevealDirection = "up"): Record<string, unknown> {
  if (Platform.OS !== "web") return {};
  return { dataSet: { reveal: visible ? "visible" : "pending", revealFrom: direction } };
}

export function revealDelay(index: number, reducedMotion = false): ViewStyle | null {
  if (Platform.OS !== "web" || reducedMotion) return null;
  return { transitionDelay: `${Math.max(0, index) * 60}ms` } as ViewStyle;
}

type RevealProps = PropsWithChildren<{
  index?: number;
  direction?: RevealDirection;
  reducedMotion?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

/** Declarative viewport reveal wrapper for sections and card grids. */
export function Reveal({ children, index = 0, direction = "up", reducedMotion = false, style }: RevealProps) {
  const { ref, visible } = useScrollReveal(reducedMotion);
  return <View
    ref={ref}
    {...(revealData(visible, direction) as ViewProps)}
    style={[style, revealDelay(index, reducedMotion)]}
  >{children}</View>;
}
