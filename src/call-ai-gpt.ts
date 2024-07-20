import OpenAI from "openai";
import { z } from "zod";
import { Readable, Transform } from "stream";
import oboe from "oboe";
import { taskPrompt } from "./prompt.ts";
import { ChatCompletionMessageParam } from "openai/resources/index.mjs";

const openai = new OpenAI();

const EditTypeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("addition"),
    atLine: z.number(),
  }),
  z.object({
    type: z.literal("replacement"),
    fromLineNumber: z.number(),
    toLineNumber: z.number(),
  }),
  z.object({
    type: z.literal("npm_install"),
    packageName: z.string(),
  }),
]);

const EditSchema = z.object({
  explain: z.string(),
  filename: z.string(),
  type: EditTypeSchema,
  code: z.string(),
});

type Edit = z.infer<typeof EditSchema>;

export async function* getAIEditsFromGPT(
  fileContent: string,
  task: string,
  model: string
): AsyncGenerator<
  | { type: "edit"; edit: Edit }
  | { type: "error"; error: string }
  | {
      type: "alledits";
      edits: Edit[];
    },
  void,
  undefined
> {
  let messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `CODE:\n${fileContent}\n`,
    },
    {
      role: "user",
      content:
        taskPrompt(task) +
        `\nRespond with a valid JSON object with the key 'edits' which contains an array of edit objects following the Edits typespec.`,
    },
  ];

  console.log("Sending messages...");

  const tokens = model.includes("mini") ? 16384 : 4096;

  const stream = await openai.chat.completions.create({
    model: model,
    messages: messages,
    stream: true,
    temperature: 0,
    response_format: { type: "json_object" },
    max_tokens: tokens,
  });

  const tokenStream = new Readable({
    read() {},
  });

  const jsonStream = new Transform({
    transform(chunk, encoding, callback) {
      this.push(chunk);
      callback();
    },
  });

  tokenStream.pipe(jsonStream);

  let fullJSON = "";
  let collectedEdits: Edit[] = [];
  let latestEdits: Edit[] = [];

  const parsePromise = new Promise<void>((resolve, reject) => {
    oboe(jsonStream)
      .node("edits.*", (edit) => {
        try {
          const validatedEdit = EditSchema.parse(edit);
          collectedEdits.push(validatedEdit);
          latestEdits.push(validatedEdit);
        } catch (error) {
          if (error instanceof z.ZodError) {
            console.warn("Invalid edit object encountered:", error.issues);
          }
        }
      })
      .done(() => {
        resolve();
      })
      .fail((error) => {
        console.error("JSON parsing error:", error);
        resolve();
      });
  });

  for await (const chunk of stream) {
    if (latestEdits.length > 0) {
      for (const edit of latestEdits) {
        yield { type: "edit", edit };
      }
      latestEdits = [];
    }

    const text = chunk.choices[0]?.delta?.content || "";
    fullJSON += text;
    tokenStream.push(text);
  }

  await parsePromise;

  try {
    const parsedJSON = JSON.parse(fullJSON);
    const allEdits = parsedJSON.edits || [];
    yield { type: "alledits", edits: allEdits };
  } catch (error) {
    console.error("Failed to parse JSON:", error);
    yield { type: "error", error: "Failed to parse JSON." };
  }
}
