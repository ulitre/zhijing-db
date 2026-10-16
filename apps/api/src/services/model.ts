import { z } from "zod";

const ModelOutputSchema = z.object({
  content: z.string().min(20),
  summary: z.string().min(8).max(240),
});

export type ModelOutput = z.infer<typeof ModelOutputSchema>;

export interface ModelProvider {
  readonly mode: "deepseek" | "deterministic-mock";
  generate(prompt: string, fallback: ModelOutput): Promise<ModelOutput>;
  generateTutor?(prompt: string, fallback: string): Promise<string>;
}

export function parseModelOutputText(raw: string): ModelOutput | undefined {
  const trimmed = raw.trim();
  const withoutFence = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const firstBrace = withoutFence.indexOf("{");
  const lastBrace = withoutFence.lastIndexOf("}");
  const candidates = [withoutFence, firstBrace >= 0 && lastBrace > firstBrace ? withoutFence.slice(firstBrace, lastBrace + 1) : ""];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = ModelOutputSchema.safeParse(JSON.parse(candidate));
      if (parsed.success) return parsed.data;
    } catch {
      // Try the next representation before falling back to deterministic content.
    }
  }
  return undefined;
}

type ResponsesPayload = {
  output_text?: string;
  output?: Array<{
    content?: Array<{ type?: string; text?: string }>;
  }>;
};

export function extractResponseOutputText(payload: ResponsesPayload): string | undefined {
  if (payload.output_text) return payload.output_text;
  return payload.output
    ?.flatMap((item) => item.content ?? [])
    .find((item) => item.type === "output_text" && item.text)
    ?.text;
}

class MockProvider implements ModelProvider {
  readonly mode = "deterministic-mock" as const;
  async generate(_prompt: string, fallback: ModelOutput) {
    return fallback;
  }
  async generateTutor(_prompt: string, fallback: string) { return fallback; }
}

class DeepSeekProvider implements ModelProvider {
  readonly mode = "deepseek" as const;
  constructor(private readonly apiKey: string) {}

  async generate(prompt: string, fallback: ModelOutput): Promise<ModelOutput> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4_000);
        const response = await fetch("https://api.deepseek.com/responses", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: process.env.DEEPSEEK_MODEL ?? "deepseek-flash",
            input: [
              {
                role: "system",
                content:
                  "你是数据库原理课程资源生成器。只能使用提供的课程事实，返回 JSON 对象，且仅含 content 和 summary 两个字符串字段。不得编造引用。",
              },
              { role: "user", content: prompt },
            ],
            reasoning: { effort: "none" },
            text: { format: { type: "json_object" } },
            max_output_tokens: 1400,
          }),
          signal: controller.signal,
        }).finally(() => clearTimeout(timer));
        if (!response.ok) throw new Error(`DeepSeek HTTP ${response.status}`);
        const payload = (await response.json()) as ResponsesPayload;
        const raw = extractResponseOutputText(payload);
        if (!raw) throw new Error("DeepSeek returned no text");
        const parsed = parseModelOutputText(raw);
        if (parsed) return parsed;
        console.warn("DeepSeek returned malformed structured output; using deterministic fallback");
        return fallback;
      } catch (error) {
        if (attempt === 1) {
          console.warn("DeepSeek generation failed; using deterministic fallback", error);
        }
      }
    }
    return fallback;
  }

  async generateTutor(prompt: string, fallback: string): Promise<string> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5_000);
      const response = await fetch("https://api.deepseek.com/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.DEEPSEEK_MODEL ?? "deepseek-flash",
          input: [
            { role: "system", content: "你是数据库原理课程 TutorAgent。只根据用户提供的课程知识证据回答，解释清楚、简洁并给出一个自检问题；不要虚构证据或引用。" },
            { role: "user", content: prompt },
          ],
          reasoning: { effort: "none" },
          max_output_tokens: 900,
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
      if (!response.ok) throw new Error(`DeepSeek tutor HTTP ${response.status}`);
      const raw = extractResponseOutputText(await response.json() as ResponsesPayload)?.trim();
      return raw && raw.length > 10 ? raw : fallback;
    } catch (error) {
      console.warn("DeepSeek tutor unavailable; using retrieved course evidence", error);
      return fallback;
    }
  }
}

export function createModelProvider(): ModelProvider {
  // Tests must be reproducible and must not depend on a developer's local key
  // or on the availability of an external model service.
  if (process.env.NODE_ENV === "test" || process.env.DEEPSEEK_MODE === "mock") {
    return new MockProvider();
  }

  return process.env.DEEPSEEK_API_KEY
    ? new DeepSeekProvider(process.env.DEEPSEEK_API_KEY)
    : new MockProvider();
}
