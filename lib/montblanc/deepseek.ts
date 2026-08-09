/**
 * The model call. DeepSeek exposes an OpenAI-compatible `/chat/completions`,
 * so this is one `fetch` and a type for what comes back.
 *
 * **Hand-rolled rather than the Vercel AI SDK**, which §3 had pencilled in back
 * when the provider was going to be Qwen. Three reasons, in order of weight:
 *
 * 1. What Montblanc actually needs from a provider library is a tool-calling
 *    loop, and that loop is `while (tool_calls) { run them; append; ask again }`
 *    — about thirty lines, right there in `route.ts` where it can be read.
 * 2. Nothing here streams tokens (see `MontblancEvent`), and streaming is the
 *    part of the SDK that is genuinely hard to write yourself. Paying for it in
 *    dependencies to not use it is the same trade §8 refused twice — the
 *    calendar library and shadcn — for the same reason.
 * 3. Swapping providers stays a one-file change, which was the whole point of
 *    picking an OpenAI-compatible endpoint. It is *this* file.
 */

const DEFAULT_BASE = "https://api.deepseek.com/v1";
const DEFAULT_MODEL = "deepseek-chat";

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ApiMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ToolSchema = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type Completion = {
  content: string | null;
  toolCalls: ToolCall[];
  /** `stop`, `tool_calls`, `length` — read by the loop to spot a truncation. */
  finishReason: string | null;
};

export class MontblancNotConfigured extends Error {
  constructor() {
    super(
      "Montblanc has no API key yet. Set DEEPSEEK_API_KEY in .env.local (and in Railway) and restart the dev server, kupo.",
    );
    this.name = "MontblancNotConfigured";
  }
}

export function isConfigured(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

export async function complete({
  messages,
  tools,
  signal,
}: {
  messages: ApiMessage[];
  tools: ToolSchema[];
  signal?: AbortSignal;
}): Promise<Completion> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new MontblancNotConfigured();

  const base = (process.env.DEEPSEEK_BASE_URL ?? DEFAULT_BASE).replace(
    /\/+$/,
    "",
  );

  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    signal,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL ?? DEFAULT_MODEL,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      // Low, deliberately. This is a dispatcher: the same sentence should file
      // the same row in the same place twice running, and the one thing it must
      // never do creatively is decide which project you meant.
      temperature: 0.1,
      max_tokens: 900,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(deepseekError(response.status, body));
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: { content?: string | null; tool_calls?: ToolCall[] };
      finish_reason?: string;
    }>;
  };

  const choice = payload.choices?.[0];
  if (!choice?.message) throw new Error("The model returned nothing usable.");

  return {
    content: choice.message.content ?? null,
    toolCalls: choice.message.tool_calls ?? [],
    finishReason: choice.finish_reason ?? null,
  };
}

/** DeepSeek's own body is JSON with a nested `error.message`, and it is the
 *  useful half — "Insufficient Balance" is a thing you can act on and a bare
 *  402 is not. Falls back to the status when the shape is unfamiliar. */
function deepseekError(status: number, body: string): string {
  let detail = "";
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    detail = parsed.error?.message ?? "";
  } catch {
    detail = body.slice(0, 200);
  }

  if (status === 401) return "DeepSeek rejected the API key.";
  if (status === 402) return `DeepSeek says: ${detail || "insufficient balance"}.`;
  if (status === 429) return "DeepSeek is rate-limiting. Try again in a moment.";
  return detail
    ? `DeepSeek returned ${status}: ${detail}`
    : `DeepSeek returned ${status}.`;
}
