import { describe, expect, it } from "vitest";
import { extractResponseOutputText, parseModelOutputText } from "../src/services/model.js";

describe("model output parsing", () => {
  const expected = { content: "这是一段满足结构化校验长度要求的数据库课程资源正文内容。", summary: "数据库课程资源摘要" };

  it("accepts direct and fenced JSON", () => {
    expect(parseModelOutputText(JSON.stringify(expected))).toEqual(expected);
    expect(parseModelOutputText(`\`\`\`json\n${JSON.stringify(expected)}\n\`\`\``)).toEqual(expected);
  });

  it("extracts JSON from provider wrapper text and rejects malformed output", () => {
    expect(parseModelOutputText(`result follows:\n${JSON.stringify(expected)}\nend`)).toEqual(expected);
    expect(parseModelOutputText("We need to produce some content first.")).toBeUndefined();
  });

  it("ignores reasoning text and reads the final Responses API output", () => {
    expect(extractResponseOutputText({
      output: [
        { content: [{ type: "reasoning_text", text: "internal reasoning" }] },
        { content: [{ type: "output_text", text: JSON.stringify(expected) }] },
      ],
    })).toBe(JSON.stringify(expected));
  });
});
