import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const RESPONSE_SCHEMA = `Return ONLY a valid JSON object with exactly these fields — no markdown fences, no explanation:
{
  "name": "name of the dish",
  "mealType": "breakfast" or "lunch" or "dinner" or "snack",
  "calories": number,
  "proteinG": number,
  "carbsG": number,
  "fatG": number,
  "fiberG": number,
  "description": "one sentence describing the meal",
  "ingredients": [
    {
      "name": "ingredient name",
      "amount": "human-readable amount, e.g. '1 cup' or '2 slices'",
      "calories": number,
      "proteinG": number,
      "carbsG": number,
      "fatG": number
    }
  ]
}
List every distinct ingredient or component. Ingredient calories/macros should sum to approximately the totals. Be realistic and accurate.`;

export async function POST(req: NextRequest) {
  const body = await req.json();

  const content: Anthropic.MessageParam["content"] = body.text
    ? [
        {
          type: "text",
          text: `The user described their meal as: "${body.text}"

Estimate the nutritional content of this meal based on the description.
${RESPONSE_SCHEMA}`,
        },
      ]
    : [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: body.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: body.image,
          },
        },
        {
          type: "text",
          text: `Analyze this meal photo and estimate its nutritional content.
${RESPONSE_SCHEMA}`,
        },
      ];

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    messages: [{ role: "user", content }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    return Response.json({ error: "Could not parse meal analysis" }, { status: 500 });
  }

  return Response.json(JSON.parse(match[0]));
}
