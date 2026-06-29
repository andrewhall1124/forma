import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { image, mediaType } = await req.json();

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: image,
            },
          },
          {
            type: "text",
            text: `Analyze this meal photo and estimate its nutritional content.
Return ONLY a valid JSON object with exactly these fields — no markdown fences, no explanation:
{
  "name": "name of the dish",
  "mealType": "breakfast" or "lunch" or "dinner" or "snack",
  "calories": number,
  "proteinG": number,
  "carbsG": number,
  "fatG": number,
  "fiberG": number,
  "description": "one sentence describing what you see"
}
Base all estimates on the portion sizes visible in the photo. Be realistic and accurate.`,
          },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    return Response.json({ error: "Could not parse meal analysis" }, { status: 500 });
  }

  return Response.json(JSON.parse(match[0]));
}
