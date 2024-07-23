import { z } from "zod";
import { Readable, Transform } from "stream";
import oboe from "oboe";
import { taskPrompt } from "./prompt";
import { AIEditGenerator, EditSchema, Edits } from "./types";

export async function* getAIEditsFromFireworks(
  fileContent: string,
  task: string,
  model: string
): AIEditGenerator {
  const apiKey = process.env.FIREWORKS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "FIREWORKS_API_KEY is not set in the environment variables"
    );
  }

  const messages = [
    {
      role: "user",
      content:
        taskPrompt(task) +
        `\nRespond with a valid JSON object with the key 'edits' which contains an array of edit objects following the Edits typespec.`,
    },
  ];

  console.log("Sending messages to Fireworks API...");

  const response = await fetch(
    "https://api.fireworks.ai/inference/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "system",
            content: `You are a helpful code editor that can only respond with a valid JSON object with the key 'edits' which contains an array of edit objects following the Edits typespec.\nCODE:\n${fileContent}\n`,
          },
          ...messages,
        ],
        max_tokens: 16384,
        temperature: 0,
        top_p: 1,
        top_k: 40,
        presence_penalty: 0,
        frequency_penalty: 0,
        stream: true,
        response_format: { type: "json_object" },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  if (!response.body) {
    throw new Error("Response body is null");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

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

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n");

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") break;

        try {
          const parsed = JSON.parse(data);
          if (
            parsed.choices &&
            parsed.choices[0] &&
            parsed.choices[0].delta &&
            parsed.choices[0].delta.content
          ) {
            const content = parsed.choices[0].delta.content;
            fullJSON += content;
            tokenStream.push(content);

            process.stdout.write(content);

            if (latestEdits.length > 0) {
              for (const edit of latestEdits) {
                yield { type: "edit", edit };
              }
              latestEdits = [];
            }
          }
        } catch (error) {
          console.error("Error parsing JSON:", error);
        }
      }
    }
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
