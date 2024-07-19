import fs from "node:fs";
import path from "node:path";
import { getAIEdits } from "../src/call-ai";

const testCode = fs.readFileSync(path.join(__dirname, "test-code.txt"), "utf8");

(async () => {
  console.log("Running AI tests...");

  const res = await getAIEdits(
    testCode,
    "Add support for openai and progress bars for everything",
    "claude-3-haiku-20240307",
    2
  );

  for await (const edit of res) {
    console.log("Packet - ", edit);
  }
})();
