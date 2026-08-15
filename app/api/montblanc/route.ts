import { auth } from "@/lib/auth";
import { buildContext } from "@/lib/montblanc/context";
import {
  complete,
  isConfigured,
  MontblancNotConfigured,
  type ApiMessage,
} from "@/lib/deepseek";
import { getNotes, recordExchange, renderNotes } from "@/lib/montblanc/memory";
import { systemMessage } from "@/lib/montblanc/prompt";
import { TOOLS, TOOL_SCHEMAS } from "@/lib/montblanc/tools";
import {
  HISTORY_TURNS,
  type MontblancEvent,
  type Turn,
} from "@/lib/montblanc/types";

/**
 * Montblanc's endpoint.
 *
 * A route handler rather than a server action, because a server action returns
 * once and this has to report *while it works* — a tool round is three or four
 * seconds and there are up to three of them, which is a long time to sit on a
 * phone looking at nothing. It streams NDJSON: one JSON object per line, read
 * by the drawer as it arrives.
 *
 * **It re-checks the session**, the same rule every server action in this app
 * follows and the same one `/api/journal/media/[id]` follows: a route handler is
 * its own public endpoint and the layout's guard does not cover it. Here it
 * matters more than usual — ungated, this is a write endpoint for the whole
 * database with a natural-language interface.
 */

/** How many times the model may call tools before it has to answer. Three is
 *  find → complete → speak, which is the longest real chain any of this has;
 *  past that it is looping and the honest thing is to stop it. */
const MAX_ROUNDS = 3;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Not signed in", { status: 401 });
  }

  if (!isConfigured()) {
    return streamOf([
      { type: "error", message: new MontblancNotConfigured().message },
    ]);
  }

  let turns: Turn[];
  let conversationId: string | null;
  try {
    const body = (await request.json()) as {
      turns?: Turn[];
      conversationId?: unknown;
    };
    turns = Array.isArray(body.turns) ? body.turns : [];
    // Minted by the drawer, one per opening, so "a conversation" means one
    // sitting. Length-capped because it becomes a primary key.
    conversationId =
      typeof body.conversationId === "string" &&
      body.conversationId.length > 0 &&
      body.conversationId.length <= 64
        ? body.conversationId
        : null;
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  if (turns.length === 0 || turns[turns.length - 1]?.role !== "user") {
    return new Response("Bad request", { status: 400 });
  }

  const question = turns[turns.length - 1].content;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: MontblancEvent) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));

      // What was finally said, so the log records the answer and not just the
      // question. Set by whichever round breaks out with words.
      let spoken: string | null = null;

      try {
        // Both in one trip. `getNotes` is one indexed read of at most fifteen
        // short rows — far cheaper than the round trip a `recall` tool would
        // have cost on every single request, which is the same trade §6 made
        // when it put "what currently exists" in the prompt rather than behind
        // a tool.
        const [context, notes] = await Promise.all([
          buildContext(),
          getNotes(),
        ]);

        const messages: ApiMessage[] = [
          {
            role: "system",
            content: systemMessage(context, renderNotes(notes)),
          },
          ...turns
            .slice(-HISTORY_TURNS)
            .map((turn) => ({ role: turn.role, content: turn.content }) as ApiMessage),
        ];

        for (let round = 0; round <= MAX_ROUNDS; round += 1) {
          // On the last round the tools are withheld rather than the reply
          // being discarded: the model is made to answer in words instead of
          // being cut off mid-chain with nothing to show for it.
          const tools = round === MAX_ROUNDS ? [] : TOOL_SCHEMAS;
          const result = await complete({
            messages,
            tools,
            signal: request.signal,
          });

          if (result.toolCalls.length === 0) {
            if (result.content?.trim()) {
              spoken = result.content.trim();
              send({ type: "text", text: spoken });
            }
            break;
          }

          messages.push({
            role: "assistant",
            content: result.content,
            tool_calls: result.toolCalls,
          });

          for (const call of result.toolCalls) {
            const tool = TOOLS[call.function.name];

            if (!tool) {
              messages.push({
                role: "tool",
                tool_call_id: call.id,
                content: `FAILED: there is no tool called ${call.function.name}.`,
              });
              continue;
            }

            send({ type: "step", label: tool.step });

            let outcome;
            try {
              outcome = await tool.run(parseArgs(call.function.arguments));
            } catch (cause) {
              // The tool's own guard rails throw here — "A task needs a title",
              // "Archive it instead". Those sentences are written to be read by
              // a person, so they are handed straight back to the model, which
              // relays them rather than inventing a reason.
              const message =
                cause instanceof Error ? cause.message : "That did not work.";
              messages.push({
                role: "tool",
                tool_call_id: call.id,
                content: `FAILED: ${message}`,
              });
              continue;
            }

            for (const event of outcome.events) send(event);
            messages.push({
              role: "tool",
              tool_call_id: call.id,
              content: outcome.summary,
            });
          }
        }
      } catch (cause) {
        if (!isAbort(cause)) {
          send({
            type: "error",
            message:
              cause instanceof Error ? cause.message : "Montblanc fell over.",
          });
        }
      } finally {
        // In the `finally`, so a round that threw still records what was asked
        // — a question that broke Montblanc is a thing worth having a record of.
        // Awaited before closing rather than left dangling: the runtime is
        // entitled to stop executing once the response is done, and a floating
        // promise here is a write that sometimes happens.
        if (conversationId) {
          try {
            await recordExchange({
              conversationId,
              question,
              answer: spoken,
            });
          } catch {
            // The log is a convenience. Failing to write it must never be the
            // reason an answer the person is already reading does not arrive.
          }
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      // Railway sits behind a proxy; without this the whole stream can be
      // buffered and delivered at the end, which is exactly the wait the
      // streaming is here to fill.
      "x-accel-buffering": "no",
    },
  });
}

/** Tool arguments arrive as a JSON *string*, and an empty one is normal for a
 *  no-argument call. Malformed is not, and an empty object lets the tool's own
 *  validation produce the error rather than this throwing first. */
function parseArgs(raw: string): Record<string, unknown> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function isAbort(cause: unknown): boolean {
  return cause instanceof Error && cause.name === "AbortError";
}

function streamOf(events: MontblancEvent[]): Response {
  const body = events.map((event) => `${JSON.stringify(event)}\n`).join("");
  return new Response(body, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8" },
  });
}
