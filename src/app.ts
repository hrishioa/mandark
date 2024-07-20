import { getAIEditsFromClaude } from "./call-ai-claude";
import { getAIEditsFromGPT } from "./call-ai-gpt";
import { processFiles } from "./process-files";
import { input, select } from "@inquirer/prompts";
import fs from "node:fs";
import { EditProcessor } from "./edit-processor";
import { countTokens } from "@anthropic-ai/tokenizer";
import { taskPrompt } from "./prompt";
import { models } from "./models";

async function main() {
  console.log("Starting the program execution...");
  let inputs = process.argv.slice(2);
  const printCodeAndExit = inputs.includes("-p");
  inputs = inputs.filter((input) => !input.startsWith("-"));

  const modelNickname = inputs.pop()!;
  let selectedModel = models.find((model) => model.nickName === modelNickname);

  if (!selectedModel) {
    inputs.push(modelNickname);
    selectedModel = models[0];
  }

  console.log(
    `Selected model: ${selectedModel.name} from ${selectedModel.provider}`
  );

  if (inputs.length === 0) {
    console.error("No files to process");
    process.exit(1);
  }

  const processedFiles = await processFiles(inputs);

  // I know this is can be wildly off, but only if large providers would actually
  // publish their tokenizers PROPERLY FFS
  const estimatedTokens = countTokens(
    processedFiles.code + taskPrompt("x".repeat(100))
  );

  const estimatedCosts =
    (estimatedTokens / 1000000) * selectedModel.inputCPM +
    selectedModel.outputCPM * (selectedModel.outputLength / 10000000);

  if (printCodeAndExit) {
    fs.writeFileSync("compiled-code.txt", processedFiles.code);
    process.exit(0);
  }

  console.log(
    `Loaded ${
      processedFiles.count
    } files (${estimatedTokens} tokens). Estimated max cost: $${estimatedCosts.toFixed(
      2
    )}`
  );

  const task = await input({
    message: "What do you need me to do?",
    validate: (input: string) => input.trim() !== "" || "Task cannot be empty",
  });

  let editPacketStream;
  if (selectedModel.provider === "anthropic") {
    editPacketStream = await getAIEditsFromClaude(
      processedFiles.code,
      task,
      selectedModel.name as
        | "claude-3-5-sonnet-20240620"
        | "claude-3-haiku-20240307"
    );
  } else if (selectedModel.provider === "openai") {
    editPacketStream = await getAIEditsFromGPT(
      processedFiles.code,
      task,
      selectedModel.name
    );
  } else {
    console.error(`Unsupported provider: ${selectedModel.provider}`);
    process.exit(1);
  }

  const editProcessor = new EditProcessor();
  await editProcessor.processEditStream(editPacketStream);
}

main();
