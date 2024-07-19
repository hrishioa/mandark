import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  MessageCreateParams,
  MessageParam,
} from "@anthropic-ai/sdk/resources/index.mjs";
import { Readable, Transform } from "stream";
import oboe from "oboe";
import { taskPrompt } from "./prompt.ts";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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

export async function* getAIEdits(
  fileContent: string,
  task: string,
  model: MessageCreateParams["model"],
  maxCalls: number,
  collectedJSON?: string
): AsyncGenerator<
  | { type: "edit"; edit: Edit }
  | { type: "error"; error: string }
  | {
      type: "alledits";
      edits: Edit[];
    }
  | {
      type: "continuing";
      callsLeft: number;
    },
  void,
  undefined
> {
  const jsonStart = collectedJSON ?? "[";

  let messages: MessageParam[] = [
    {
      role: "user",
      content: taskPrompt(task),
    },
    {
      role: "assistant",
      content: jsonStart,
    },
  ];

  console.log("Sending messages...");

  const stream = await anthropic.messages.create({
    messages,
    model,
    max_tokens: 4096,
    stream: true,
    temperature: 0,
    system: `CODE:\n${fileContent}\n`,
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

  let fullJSON = jsonStart;
  let collectedEdits: Edit[] = [];
  let latestEdits: Edit[] = [];

  const parsePromise = new Promise<void>((resolve, reject) => {
    oboe(jsonStream)
      .node("!.*", (edit) => {
        try {
          const validatedEdit = EditSchema.parse(edit);
          // console.log("Valid edit object found:", validatedEdit);
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

  tokenStream.push(jsonStart);

  for await (const chunk of stream) {
    if (latestEdits.length > 0) {
      for (const edit of latestEdits) {
        yield { type: "edit", edit };
      }
      latestEdits = [];
    }

    if (
      chunk.type === "content_block_delta" &&
      chunk.delta?.type === "text_delta"
    ) {
      const text = chunk.delta.text;
      fullJSON += text;
      tokenStream.push(text);
    }
  }

  await parsePromise;

  try {
    const allEdits = JSON.parse(fullJSON);
    yield { type: "alledits", edits: allEdits };
  } catch (error) {
    // console.error("Failed to parse JSON:", error);
    if (collectedEdits.length > 0 && maxCalls > 0) {
      console.log("\n\n########### Will continue. ##########\n");

      const packetStream = await getAIEdits(
        fileContent,
        task,
        model,
        maxCalls - 1,
        fullJSON
      );

      for await (const packet of packetStream) {
        if (packet.type === "edit") {
          if (
            collectedEdits.find(
              (edit) =>
                edit.filename === packet.edit.filename &&
                JSON.stringify(edit.type) === JSON.stringify(packet.edit.type)
            )
          ) {
            console.warn("Duplicate edit found. Skipping...");
            continue;
          }
          collectedEdits.push(packet.edit);
        }

        yield packet;
      }
    } else {
      console.error("Failed to parse JSON:", error);
      yield { type: "error", error: "Failed to parse JSON." };
    }
  }
}
