import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  responseJsonSchema,
} from "@/lib/ai-prompt";
import { analysisSchema } from "@/lib/validation";
import type { Analysis, ReadingRequest } from "@/types/tarot";
import { TAROT_CARDS } from "@/data/tarot";

type AIMode = "responses" | "chat";
interface AIConfig {
  key: string | undefined;
  url: string;
  mode: AIMode;
  model: string;
}
// Server-only config. AI_* wins; OPENAI_* stays as a fallback. The protocol is
// inferred from the URL: .../chat/completions or .../responses are used as-is,
// a bare base URL gets /chat/completions (the most widely supported shape).
// With only OPENAI_* set, the original Responses API default is kept.
function readAIConfig(): AIConfig {
  const key = process.env.AI_API_KEY?.trim();
  const model = (process.env.AI_MODEL ?? "gemini-3-flash").trim();
  const raw = process.env.AI_API_URL?.trim().replace(/\/+$/, "");
  if (!raw)
    return {
      key,
      model,
      mode: "responses",
      url: `${(process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "")}/responses`,
    };
  if (/\/chat\/completions$/.test(raw))
    return { key, model, mode: "chat", url: raw };
  if (/\/responses$/.test(raw))
    return { key, model, mode: "responses", url: raw };
  return { key, model, mode: "chat", url: `${raw}/chat/completions` };
}
async function callProvider(
  cfg: AIConfig,
  request: ReadingRequest,
  signal: AbortSignal,
): Promise<Response> {
  const post = (body: unknown) =>
    fetch(cfg.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.key}`,
      },
      body: JSON.stringify(body),
      signal,
      cache: "no-store",
    });
  const schema = responseJsonSchema(request);
  if (cfg.mode === "responses") {
    return post({
      model: cfg.model,
      instructions: SYSTEM_PROMPT,
      input: buildUserPrompt(request),
      store: false,
      max_output_tokens: 4500,
      text: {
        format: {
          type: "json_schema",
          name: "tarot_analysis",
          strict: true,
          schema,
        },
      },
    });
  }
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserPrompt(request) },
  ];
  const strict = await post({
    model: cfg.model,
    messages,
    max_tokens: 4500,
    response_format: {
      type: "json_schema",
      json_schema: { name: "tarot_analysis", strict: true, schema },
    },
  });
  if (strict.status !== 400 && strict.status !== 422) return strict;
  // Provider has no json_schema support: fall back to JSON mode. The schema
  // is appended to the prompt and verifyAnalysis still validates everything.
  return post({
    model: cfg.model,
    max_tokens: 4500,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `${SYSTEM_PROMPT}\n\nReturn ONLY a JSON object matching this JSON Schema:\n${JSON.stringify(schema)}`,
      },
      messages[1],
    ],
  });
}
// Normalise a chat-completions payload into the Responses shape the parser expects.
function normalizePayload(payload: any, mode: AIMode): any {
  if (mode === "responses") return payload;
  const choice = payload?.choices?.[0];
  const message = choice?.message;
  if (!message || choice.finish_reason === "length")
    return { status: "incomplete", output: [] };
  if (message.refusal)
    return {
      status: "completed",
      output: [{ content: [{ type: "refusal" }] }],
    };
  const text = typeof message.content === "string" ? message.content : "";
  // Some providers wrap JSON in a markdown fence.
  const clean = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return {
    status: "completed",
    output: [{ content: [{ type: "output_text", text: clean }] }],
  };
}
export class AIError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
export function verifyAnalysis(
  value: unknown,
  request: ReadingRequest,
): Analysis {
  const parsed = analysisSchema.safeParse(value);
  if (!parsed.success)
    throw new AIError(
      "INVALID_RESPONSE",
      "AI trả về dữ liệu không hợp lệ. Hãy thử phân tích lại.",
      502,
    );
  const analysis = parsed.data;
  if (!analysis.message)
    throw new AIError(
      "MISSING_MESSAGE",
      "AI chưa đưa ra thông điệp cho câu hỏi của bạn. Hãy thử lại với các lá đã mở.",
      502,
    );
  if (!analysis.attention)
    throw new AIError(
      "MISSING_ATTENTION",
      "AI chưa nêu điều bạn cần chú ý trong câu hỏi này. Hãy thử lại với các lá đã mở.",
      502,
    );
  const prose = [
    analysis.overview,
    analysis.message,
    analysis.attention,
    analysis.connections,
    analysis.advice,
    analysis.love,
    analysis.career,
    analysis.finance,
    ...analysis.cards.map((c) => c.interpretation),
  ]
    .filter(Boolean)
    .join("\n");
  const drawnIds = new Set(request.cards.map((c) => c.cardId));
  // Guard explicit card names in prose as well as structured IDs. This cannot
  // establish interpretive correctness, but rejects added named cards.
  for (const card of TAROT_CARDS) {
    if (drawnIds.has(card.id)) continue;
    const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const english = new RegExp(`\\b${escape(card.name)}\\b`, "i");
    const vietnamese = new RegExp(
      `lá(?:\\s+bài)?\\s+${escape(card.nameVi)}(?:\\s|[.,;:!?]|$)`,
      "i",
    );
    if (english.test(prose) || vietnamese.test(prose))
      throw new AIError(
        "EXTRA_CARD",
        "AI nhắc tới lá ngoài trải bài nên kết quả đã được từ chối. Hãy thử lại với các lá hiện có.",
        502,
      );
  }
  if (
    /\d+(?:[.,]\d+)?\s*%|phần trăm|xác suất\s+(?:là|đạt|khoảng)?\s*\d/i.test(
      prose,
    )
  )
    throw new AIError(
      "FALSE_PROBABILITY",
      "AI đưa ra tỷ lệ không có cơ sở nên kết quả đã được từ chối. Hãy thử lại.",
      502,
    );
  if (
    analysis.cards.length !== request.cards.length ||
    analysis.cards.some(
      (card, i) =>
        card.cardId !== request.cards[i].cardId ||
        card.orientation !== request.cards[i].orientation ||
        card.position !== request.cards[i].position,
    )
  ) {
    throw new AIError(
      "CARD_MISMATCH",
      "Kết quả AI không khớp các lá đã rút và đã được từ chối. Bạn có thể thử lại với nguyên trải bài.",
      502,
    );
  }
  if (
    ((request.spreadId === "love" || request.topic === "love") &&
      !analysis.love) ||
    ((request.spreadId === "career" || request.topic === "career") &&
      !analysis.career) ||
    (request.topic === "finance" && !analysis.finance)
  ) {
    throw new AIError(
      "MISSING_TOPIC",
      "AI chưa phân tích đầy đủ chủ đề. Hãy thử lại.",
      502,
    );
  }
  return analysis;
}
export async function analyzeWithAI(
  request: ReadingRequest,
  clientSignal?: AbortSignal,
): Promise<Analysis> {
  const cfg = readAIConfig();
  const key = cfg.key;
  if (!key)
    throw new AIError(
      "AI_NOT_CONFIGURED",
      "Chưa kết nối dịch vụ AI. Bạn vẫn có thể đọc ý nghĩa chuẩn của trải bài bên dưới.",
      503,
    );
  let response: Response;
  try {
    response = await callProvider(
      cfg,
      request,
      clientSignal
        ? AbortSignal.any([clientSignal, AbortSignal.timeout(55000)])
        : AbortSignal.timeout(55000),
    );
  } catch (error) {
    const cause = (error as { cause?: { code?: string; message?: string } })
      .cause;
    console.error(
      "[ai] provider request failed:",
      (error as Error).name,
      cause?.code ?? cause?.message ?? (error as Error).message,
    );
    throw new AIError(
      "AI_UNAVAILABLE",
      "Không kết nối được AI hoặc yêu cầu quá thời gian. Các lá đã rút vẫn được giữ nguyên.",
      504,
    );
  }
  if (!response.ok)
    throw new AIError(
      "AI_PROVIDER_ERROR",
      response.status === 429
        ? "Dịch vụ AI đang giới hạn lượt gọi. Vui lòng thử lại sau."
        : "Dịch vụ AI chưa xử lý được yêu cầu. Vui lòng thử lại hoặc đọc ý nghĩa chuẩn.",
      502,
    );
  try {
    const payload = normalizePayload(await response.json(), cfg.mode);
    if (payload.status !== "completed")
      throw new AIError(
        "AI_INCOMPLETE",
        "AI chưa hoàn thành phân tích. Bạn có thể thử lại.",
        502,
      );
    const parts: { type: string; text?: string }[] = (
      payload.output ?? []
    ).flatMap((o: { content?: unknown[] }) => o.content ?? []);
    if (parts.some((p) => p.type === "refusal"))
      throw new AIError(
        "AI_REFUSAL",
        "AI không thể diễn giải câu hỏi này. Bạn có thể đọc ý nghĩa chuẩn hoặc đặt câu hỏi khác.",
        422,
      );
    const raw = parts
      .filter((p) => p.type === "output_text")
      .map((p) => p.text ?? "")
      .join("");
    return verifyAnalysis(JSON.parse(raw), request);
  } catch (error) {
    if (error instanceof AIError) throw error;
    throw new AIError(
      "INVALID_RESPONSE",
      "AI trả về dữ liệu không hợp lệ. Hãy thử lại.",
      502,
    );
  }
}
