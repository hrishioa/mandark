import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  MessageCreateParams,
  MessageParam,
} from "@anthropic-ai/sdk/resources/index.mjs";
import { Readable, Transform } from "stream";
import oboe from "oboe";
import { taskPrompt } from "./prompt";
import { AIEditGenerator, EditSchema, Edits } from "./types";

export async function* getAIEditsFromClaude(
  fileContent: string,
  task: string,
  model: Extract<
    MessageCreateParams["model"],
    "claude-3-5-sonnet-20240620" | "claude-3-haiku-20240307"
  >
): AIEditGenerator {
  const anthropic = new Anthropic();

  const jsonStart = "[";

  let messages: MessageParam[] = [
    {
      role: "user",
      content:
        taskPrompt(task) +
        `\nRespond only with valid JSON array elements following the Edits typespec.`,
    },
    {
      role: "assistant",
      content: jsonStart,
    },
  ];

  console.log("\n\nGetting edits...");

  const tokens = model === "claude-3-5-sonnet-20240620" ? 8192 : 4096;
  const headers =
    model === "claude-3-5-sonnet-20240620"
      ? {
          "anthropic-beta": "max-tokens-3-5-sonnet-2024-07-15",
        }
      : {};

  const stream = await anthropic.messages.create(
    {
      messages,
      model,
      max_tokens: tokens,
      stream: true,
      temperature: 0,
      system: `CODE:\n${fileContent}\n`,
    },
    {
      headers,
    }
  );

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
  let collectedEdits: Edits = [];
  let latestEdits: Edits = [];
  let streamStatus: string = "notStarted";

  const parsePromise = new Promise<void>((resolve, reject) => {
    oboe(jsonStream)
      .node("!.*", (edit) => {
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
      .node("!.*.filename", (filename: string) => {
        console.log("\nTo File: ", filename);
      })
      .path("!.*.explain", () => {
        streamStatus = "reasonEntered";
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

      if (streamStatus === "reasonEntered") {
        if (text.includes(`"`)) {
          process.stdout.write("\nChange: ");
          streamStatus = "reasonStarted";
        }
        process.stdout.write(
          text.split(`"`).length > 1 ? text.split(`"`)[1] : ""
        );
      } else if (streamStatus === "reasonStarted") {
        process.stdout.write(text.split(`"`)[0]);
        if (text.includes(`"`)) {
          streamStatus = "reasonEnded";
        }
      }

      fullJSON += text;
      tokenStream.push(text);
    }
  }

  await parsePromise;

  try {
    const allEdits = JSON.parse(fullJSON);
    yield { type: "alledits", edits: allEdits };
  } catch (error) {
    console.error("Failed to parse JSON:", error);
    yield { type: "error", error: "Failed to parse JSON." };
  }
}
