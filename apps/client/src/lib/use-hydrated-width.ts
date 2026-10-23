import { useEffect, useLayoutEffect, useState } from "react";
import { Platform, useWindowDimensions } from "react-native";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Returns the real window width only after the first client commit.
 *
 * Static rendering evaluates `useWindowDimensions` with width 0. Returning 0 for
 * the hydration render keeps the client tree identical to the server output,
 * then the layout effect swaps in the real width before the first paint.
 */
export function useHydratedWidth(): number {
  const { width } = useWindowDimensions();
  const [hydrated, setHydrated] = useState(Platform.OS !== "web");
  useIsomorphicLayoutEffect(() => {
    if (Platform.OS === "web") setHydrated(true);
  }, []);
  return hydrated ? width : 0;
}
