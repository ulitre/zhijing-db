import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("client API adapter", () => {
  it("uses the configured API URL", async () => {
    vi.stubEnv("EXPO_PUBLIC_API_URL", "https://example.test/");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ path: [], resources: [] }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    const { getDashboard, isApiConfigured } = await import("./api");
    expect(isApiConfigured()).toBe(true);
    await expect(getDashboard("demo-foundation")).resolves.toEqual({ path: [], resources: [] });
    expect(fetchMock).toHaveBeenCalledWith("https://example.test/api/dashboard/demo-foundation", expect.any(Object));
  });

  it("stays in local demo mode when no URL is configured", async () => {
    vi.stubEnv("EXPO_PUBLIC_API_URL", "");
    const { getDashboard, isApiConfigured } = await import("./api");
    expect(isApiConfigured()).toBe(false);
    await expect(getDashboard("demo-foundation")).rejects.toThrow("not configured");
  });

  it("sends tutor questions to the scoped tutor endpoint", async () => {
    vi.stubEnv("EXPO_PUBLIC_API_URL", "https://example.test");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ answer: "课程回答", citations: [], refused: false }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    const { askTutor } = await import("./api");
    await expect(askTutor({ userId: "demo-foundation", question: "什么是主键？", nodeId: "keys-integrity" })).resolves.toMatchObject({ refused: false });
    expect(fetchMock).toHaveBeenCalledWith("https://example.test/api/tutor", expect.objectContaining({ method: "POST" }));
  });
});
