import OpenAI from "openai";
import { z } from "zod";
import { Readable, Transform } from "stream";
import oboe from "oboe";
import { taskPrompt } from "./prompt";
import { ChatCompletionMessageParam } from "openai/resources/index.mjs";
import { AIEditGenerator, EditSchema, Edits } from "./types";

export async function* getAIEditsFromGPT(
  fileContent: string,
  task: string,
  model: string
): AIEditGenerator {
  const openai = new OpenAI();

  console.log("Model is O1? ", model.includes("o1"));

  let messages: ChatCompletionMessageParam[] = [
    {
      role: model.includes("o1") ? "system" : "user",
      content: `CODE:\n${fileContent}\n`,
    },
    {
      role: "user",
      content:
        taskPrompt(task) +
        `\nRespond with a valid JSON object with the key 'edits' which contains an array of edit objects following the Edits typespec.`,
    },
  ];

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
  let collectedEdits: Edits = [];
  let latestEdits: Edits = [];
  let streamStatus: string = "notStarted";

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
      .node("edits.*.filename", (filename: string) => {
        console.log("\nTo File: ", filename);
      })
      .path("edits.*.explain", () => {
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

  for await (const chunk of stream) {
    if (latestEdits.length > 0) {
      for (const edit of latestEdits) {
        yield { type: "edit", edit };
      }
      latestEdits = [];
    }

    const text = chunk.choices[0]?.delta?.content || "";
    fullJSON += text;

    if (streamStatus === "reasonEntered") {
      if (text.includes('"')) {
        process.stdout.write("\nChange: ");
        streamStatus = "reasonStarted";
      }
      process.stdout.write(
        text.split('"').length > 1 ? text.split('"')[1] : ""
      );
    } else if (streamStatus === "reasonStarted") {
      process.stdout.write(text.split('"')[0]);
      if (text.includes('"')) {
        streamStatus = "reasonEnded";
      }
    }

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
