import { describe, expect, it } from "vitest";
import { demoUsers, planLearningPath, updateMastery } from "../src/index.js";

describe("mastery model", () => {
  it("can increase and decrease as evidence changes", () => {
    const improved = updateMastery(50, {
      correctness: 100,
      hintIndependence: 100,
      responseQuality: 90,
      confidenceCalibration: 90,
    });
    const declined = updateMastery(80, {
      correctness: 0,
      hintIndependence: 20,
      responseQuality: 20,
      confidenceCalibration: 20,
    });
    expect(improved).toBeGreaterThan(50);
    expect(declined).toBeLessThan(80);
  });
});

describe("path planner", () => {
  it("creates distinct recommendations for the three personas", () => {
    const paths = demoUsers.map((user) => planLearningPath(user.profile));
    expect(paths.every((path) => path.length > 0)).toBe(true);
    expect(paths[0]?.[0]?.recommendedResource).toBe("diagram");
    expect(paths[1]?.[0]?.recommendedResource).toBe("quiz");
    expect(paths[2]?.[0]?.recommendedResource).toBe("sql-lab");
    expect(paths[0]?.[0]?.nodeId).toBe("relations");
    expect(paths[1]?.[0]?.nodeId).toBe("nf-3bc");
    expect(paths[2]?.[0]?.nodeId).toBe("index-design");
    expect(paths[2]?.some((step) => step.nodeId === "sql-select")).toBe(false);
  });
});
