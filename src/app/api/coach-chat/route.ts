import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { resolveViewer } from "@/lib/access";
import { COACH_TOOLS, runCoachTool } from "@/lib/coach-tools";

const client = new Anthropic();

const SYSTEM = `You are Forma's built-in fitness coach: an expert endurance running coach, sports nutritionist, and strength coach rolled into one. You are talking to the athlete inside their own Forma dashboard.

You have read-only tools to look at the athlete's real data (Garmin smart-scale body composition, synced activities, weekly running volume, sleep, logged nutrition, and their upcoming plan). Ground every substantive claim in their actual data — call the relevant tools before giving numbers or recommendations rather than guessing. You may call several tools at once, and call more as the conversation goes.

Critically, an activity's listed pace is the whole-session AVERAGE, which hides interval work: a hard rep session (fast reps + slow recoveries) averages out to look like an easy run. Before judging how fast the athlete can run — especially for speed, threshold, VO2max, or race-pace questions — open the splits of their quality sessions with get_activity_splits (interval workouts are usually named like "... Workout (N)"). Look at the fast reps, not the average, to gauge their true current speed and paces.

Units: the database is metric — distances in metres, pace in seconds-per-km, weight in kilograms, durations in seconds. The athlete is in the US, so present distances in miles, pace in min/mile (you may add min/km in parentheses), and weight in pounds. Convert for them; don't make them do math.

Style: be direct, specific, and encouraging. Lead with the answer, then the reasoning. Use short markdown sections, bold key numbers, and concrete targets (paces, weekly mileage, calorie/protein numbers, body-fat/weight goals). Flag when data looks thin (e.g. only a few scale readings) rather than over-interpreting it.

You cannot change anything in Forma — you only read and advise. If the athlete wants to log a meal, schedule a workout, or edit their plan, tell them which page to use. You are not a doctor; add a brief caveat for anything medical, injury-related, or involving aggressive weight loss.`;

type ClientMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  const { subjectUserId } = await resolveViewer();
  if (!subjectUserId) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json();
  const clientMessages: ClientMessage[] = Array.isArray(body.messages) ? body.messages : [];

  // Keep the last ~20 turns; drop empties.
  const messages: Anthropic.MessageParam[] = clientMessages
    .filter((m) => m.content?.trim())
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content }));

  if (messages.length === 0 || messages[0].role !== "user") {
    return Response.json({ error: "Expected a user message" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      try {
        // Agentic loop: stream each model turn; when it asks for tools, run
        // them and continue. Bounded so a misbehaving loop can't run forever.
        for (let round = 0; round < 8; round++) {
          const ms = client.messages.stream({
            model: "claude-opus-4-8",
            max_tokens: 8192,
            system: SYSTEM,
            tools: COACH_TOOLS,
            thinking: { type: "adaptive" },
            output_config: { effort: "medium" },
            messages,
          });

          for await (const event of ms) {
            if (
              event.type === "content_block_start" &&
              event.content_block.type === "tool_use"
            ) {
              send({ type: "tool", name: event.content_block.name });
            } else if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              send({ type: "text", text: event.delta.text });
            }
          }

          const msg = await ms.finalMessage();
          messages.push({ role: "assistant", content: msg.content });

          if (msg.stop_reason === "tool_use") {
            const results: Anthropic.ToolResultBlockParam[] = [];
            for (const block of msg.content) {
              if (block.type === "tool_use") {
                const result = await runCoachTool(
                  block.name,
                  (block.input ?? {}) as Record<string, unknown>,
                  subjectUserId,
                );
                results.push({
                  type: "tool_result",
                  tool_use_id: block.id,
                  content: JSON.stringify(result),
                });
              }
            }
            messages.push({ role: "user", content: results });
            continue;
          }

          break; // end_turn / stop_sequence / etc.
        }
        send({ type: "done" });
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
