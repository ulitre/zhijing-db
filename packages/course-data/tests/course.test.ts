import { describe, expect, it } from "vitest";
import { knowledgeNodes } from "../src/index.js";

describe("course graph", () => {
  it("contains the frozen 45-node syllabus", () => {
    expect(knowledgeNodes).toHaveLength(45);
  });

  it("only references known prerequisite nodes", () => {
    const ids = new Set(knowledgeNodes.map((node) => node.id));
    for (const node of knowledgeNodes) {
      expect(node.prerequisites.every((id) => ids.has(id))).toBe(true);
    }
  });
});
