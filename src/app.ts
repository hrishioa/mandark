#!/usr/bin/env node
import { askAI } from "./askAI";

import chalk from "chalk";
import { getAIEditsFromClaude } from "./call-ai-claude";
import { getAIEditsFromGPT } from "./call-ai-gpt";
import { processFiles } from "./process-files";
import { input } from "@inquirer/prompts";
import fs from "node:fs";
import { EditProcessor } from "./edit-processor";
import { countTokens } from "@anthropic-ai/tokenizer";
import { taskPrompt } from "./prompt";
import { models } from "./models";
import { password } from "@inquirer/prompts";
import { getAIEditsFromFireworks } from "./call-fireworks";

function listAvailableModels() {
  console.log("Available models:");
  models.forEach((model) => {
    console.log(`- ${model.nickName}: ${model.name} (${model.provider})`);
  });
  console.log(
    "\nYou can append the model nickname to the end of your command to use a specific model."
  );
}

async function checkAndSetAPIKey(selectedModel: (typeof models)[number]) {
  const provider = selectedModel.provider;
  const apiKey = await getAPIKey(provider);

  if (provider === "anthropic") {
    process.env.ANTHROPIC_API_KEY = apiKey;
  } else if (provider === "openai") {
    process.env.OPENAI_API_KEY = apiKey;
  } else if (provider === "fireworks") {
    process.env.FIREWORKS_API_KEY = apiKey;
  }

  console.log(chalk.green(`API key for ${provider} has been set.`));
}

async function getAPIKey(provider: string): Promise<string> {
  const envVar =
    provider === "anthropic"
      ? "ANTHROPIC_API_KEY"
      : provider === "openai"
      ? "OPENAI_API_KEY"
      : "FIREWORKS_API_KEY";
  if (!process.env[envVar]) {
    console.log(chalk.yellow(`\n${envVar} is not set in your environment.`));
    const apiKey = await password({
      message: `Please enter your ${
        provider.charAt(0).toUpperCase() + provider.slice(1)
      } API key:`,
      mask: "*",
    });
    process.env[envVar] = apiKey;
  }
  return process.env[envVar]!;
}

async function main() {
  console.log("Welcome to Mandark!");
  let inputs = process.argv.slice(2);
  const printCodeAndExit = inputs.includes("-p");
  const includeImports = inputs.includes("-a");
  inputs = inputs.filter((input) => !input.startsWith("-") && !!input);

  listAvailableModels();

  const modelNickname = inputs.pop()!;
  let selectedModel = models.find((model) => model.nickName === modelNickname);

  if (!selectedModel) {
    if (modelNickname) inputs.push(modelNickname);
    selectedModel = models[0];
  }

  console.log(
    `Selected model: ${selectedModel.nickName} (${selectedModel.name} from ${selectedModel.provider})`
  );

  await checkAndSetAPIKey(selectedModel);

  if (inputs.length === 0) {
    console.error("No files or folders to process");
    process.exit(1);
  }

  const processedFiles = await processFiles(inputs, includeImports);

  if (printCodeAndExit) {
    fs.writeFileSync("compiled-code.txt", processedFiles.code);
    console.log("Code saved to compiled-code.txt");
    process.exit(0);
  }

  const estimatedTokens = countTokens(
    processedFiles.code + taskPrompt("x".repeat(100))
  );

  const estimatedCosts =
    (estimatedTokens / 1000000) * selectedModel.inputCPM +
    selectedModel.outputCPM * (selectedModel.outputLength / 10000000);

  console.log(
    `Loaded ${
      processedFiles.count
    } files (${estimatedTokens} tokens). Estimated max cost: $${estimatedCosts.toFixed(
      4
    )}`
  );

  const task = await input({
    message:
      "What do you need me to do? (Type 'ask' followed by your question to ask a question instead): ",
    validate: (input: string) => input.trim() !== "" || "Task cannot be empty",
  });

  if (task.toLowerCase().startsWith("ask ")) {
    const question = task.slice(4).trim();
    const answerStream = askAI(
      processedFiles.code,
      question,
      selectedModel.name,
      selectedModel.provider
    );
    for await (const chunk of answerStream) {
      process.stdout.write(chunk);
    }
    console.log("\n");
  } else {
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
    } else if (selectedModel.provider === "fireworks") {
      editPacketStream = await getAIEditsFromFireworks(
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

  console.log(
    chalk.cyan(
      "Leave a star if you like it! https://github.com/hrishioa/mandark"
    )
  );
}

main().catch(console.error);
