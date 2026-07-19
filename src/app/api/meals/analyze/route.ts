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

type ImageInput = { data: string; mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" };

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Accept a list of images (new) or a single legacy {image, mediaType} pair.
  const images: ImageInput[] = Array.isArray(body.images)
    ? body.images
    : body.image
    ? [{ data: body.image, mediaType: body.mediaType }]
    : [];

  const note: string = typeof body.note === "string" ? body.note.trim() : "";
  const noteLine = note ? `\n\nThe user added this note about the meal — use it to refine your estimate: "${note}"` : "";

  const content: Anthropic.MessageParam["content"] = body.text
    ? [
        {
          type: "text",
          text: `The user described their meal as: "${body.text}"

Estimate the nutritional content of this meal based on the description.${noteLine}
${RESPONSE_SCHEMA}`,
        },
      ]
    : [
        ...images.map(
          (img): Anthropic.ImageBlockParam => ({
            type: "image",
            source: { type: "base64", media_type: img.mediaType, data: img.data },
          })
        ),
        {
          type: "text",
          text: `Analyze ${images.length > 1 ? "these meal photos (all showing the same meal, e.g. different angles or the nutrition label)" : "this meal photo"} and estimate the nutritional content.${noteLine}
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
