"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, ArrowUp } from "lucide-react";
import { cn } from "@/lib/cn";

type Message = { role: "user" | "assistant"; content: string };

const TOOL_LABELS: Record<string, string> = {
  get_body_composition: "Checking your scale data",
  get_training_summary: "Reviewing your training volume",
  get_activities: "Looking at your workouts",
  get_sleep: "Checking your sleep",
  get_nutrition: "Reviewing your nutrition",
  get_plan: "Looking at your plan",
};

const SUGGESTIONS = [
  "Evaluate my fitness and how to get faster at the half marathon.",
  "What body-fat % and weight should I target for the half?",
  "Design a training week based on my recent running.",
  "Is my nutrition supporting my training? What should change?",
];

// Minimal, dependency-free markdown for the coach's replies: headings, bullet
// lists, blank-line spacing, plus inline **bold** and `code`. Builds React
// nodes directly — no dangerouslySetInnerHTML.
function inline(text: string, keyBase: string) {
  const nodes: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|`(.+?)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1] != null) {
      nodes.push(
        <strong key={`${keyBase}-b${i}`} className="font-semibold text-neutral-50">
          {m[1]}
        </strong>,
      );
    } else {
      nodes.push(
        <code key={`${keyBase}-c${i}`} className="rounded bg-neutral-800 px-1 py-0.5 text-[0.85em]">
          {m[2]}
        </code>,
      );
    }
    last = m.index + m[0].length;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function Markdown({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  let key = 0;

  const flushList = () => {
    if (list.length === 0) return;
    const items = list;
    blocks.push(
      <ul key={`ul${key++}`} className="my-1.5 ml-1 space-y-1">
        {items.map((item, idx) => (
          <li key={idx} className="flex gap-2">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent-400" />
            <span>{inline(item, `li${key}-${idx}`)}</span>
          </li>
        ))}
      </ul>,
    );
    list = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (bullet) {
      list.push(bullet[1]);
      continue;
    }
    flushList();
    if (heading) {
      blocks.push(
        <p key={`h${key++}`} className="mt-3 mb-1 font-semibold text-neutral-50">
          {inline(heading[2], `h${key}`)}
        </p>,
      );
    } else if (line.trim() === "") {
      blocks.push(<div key={`sp${key++}`} className="h-2" />);
    } else {
      blocks.push(
        <p key={`p${key++}`} className="leading-relaxed">
          {inline(line, `p${key}`)}
        </p>,
      );
    }
  }
  flushList();
  return <div className="text-sm text-neutral-200">{blocks}</div>;
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, status]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    const history: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    setStatus("Thinking");

    try {
      const res = await fetch("/api/coach-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      if (!res.ok || !res.body) throw new Error("Request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const appendText = (chunk: string) => {
        setStatus(null);
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "assistant",
            content: next[next.length - 1].content + chunk,
          };
          return next;
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          if (!part.trim()) continue;
          let evt: { type: string; text?: string; name?: string; message?: string };
          try {
            evt = JSON.parse(part);
          } catch {
            continue;
          }
          if (evt.type === "text" && evt.text) appendText(evt.text);
          else if (evt.type === "tool" && evt.name)
            setStatus(TOOL_LABELS[evt.name] ?? "Checking your data");
          else if (evt.type === "error")
            appendText(`\n\n_Something went wrong: ${evt.message ?? "unknown error"}._`);
        }
      }
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        const lastMsg = next[next.length - 1];
        if (lastMsg?.role === "assistant" && !lastMsg.content) {
          next[next.length - 1] = {
            role: "assistant",
            content: "_Sorry — I couldn't reach the coach just now. Try again._",
          };
        }
        return next;
      });
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-neutral-800 px-4 py-4 md:px-6">
        <h1 className="flex items-center gap-2 text-lg font-semibold text-neutral-100">
          <Sparkles size={18} className="text-accent-400" />
          Coach
        </h1>
        <p className="mt-0.5 text-sm text-neutral-500">
          Ask about your training, nutrition, body composition, and goals — grounded in your Forma
          data.
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 md:px-6">
        {empty ? (
          <div className="mx-auto max-w-lg">
            <p className="mb-3 text-sm text-neutral-500">Try asking:</p>
            <div className="space-y-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-900/40 px-4 py-3 text-left text-sm text-neutral-300 transition-colors hover:border-neutral-700 hover:bg-neutral-800/60"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
              >
                {m.role === "user" ? (
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-accent-500/15 px-4 py-2.5 text-sm text-neutral-100">
                    {m.content}
                  </div>
                ) : (
                  <div className="max-w-[95%]">
                    {m.content ? (
                      <Markdown content={m.content} />
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-neutral-500">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-400" />
                        {status ?? "Thinking"}…
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {busy && status && messages[messages.length - 1]?.content ? (
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-400" />
                {status}…
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="border-t border-neutral-800 bg-neutral-950/80 px-4 py-3 md:px-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mx-auto flex max-w-2xl items-end gap-2"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Ask your coach…"
            className="max-h-40 flex-1 resize-none rounded-xl border border-neutral-800 bg-neutral-900 px-3.5 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-500 text-white transition-colors hover:bg-accent-400 disabled:opacity-40"
            aria-label="Send"
          >
            <ArrowUp size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
