#!/usr/bin/env node
import { askAI } from "./askAI";
import { input, confirm, password } from "@inquirer/prompts";
import chalk from "chalk";
import { getAIEditsFromClaude } from "./call-ai-claude";
import { getAIEditsFromGPT } from "./call-ai-gpt";
import { processFiles } from "./process-files";
import fs from "node:fs";
import { EditProcessor } from "./edit-processor";
import { countTokens } from "@anthropic-ai/tokenizer";
import { taskPrompt } from "./prompt";
import { models, preferredVerifierModel } from "./models";
import { getAIEditsFromFireworks } from "./call-fireworks";
import { verifyEditStream } from "./verify-edits";
import { checkAPIKey, getAndSetAPIKey } from "./apiKeyUtils";
import { revertLastChanges } from "./edit-history";
import { extractGitHubUrl } from "./github-utils";

function listAvailableModels() {
  console.log(
    "\nAvailable models:",
    models.map((model) => model.nickName).join(", ")
  );
  console.log(
    "\nYou can append the model nickname to the end of your command to use a specific model."
  );
}

async function checkAndSetAPIKey(selectedModel: (typeof models)[number]) {
  const provider = selectedModel.provider;
  const apiKeyPresent = checkAPIKey(provider);

  if (!apiKeyPresent) {
    await getAndSetAPIKey(provider);
  }

  console.log(chalk.green(`API key for ${provider} has been set.`));
}

function checkContextWindowOverflow(
  inputTokens: number,
  selectedModel: (typeof models)[number]
): { overflow: boolean; overflowTokens?: number; overflowPercentage?: number } {
  const availableTokens =
    selectedModel.contextWindow - selectedModel.outputLength;
  if (inputTokens > availableTokens) {
    const overflowTokens = inputTokens - availableTokens;
    const overflowPercentage = (overflowTokens / availableTokens) * 100;
    return { overflow: true, overflowTokens, overflowPercentage };
  }
  return { overflow: false };
}

function displayHelp() {
  const helpText = `
Mandark - Super simple, easily modifiable AI Coder

Usage:
  npx mandark [options] <file(s)/dir(s)/github-url(s)> [model-nickname]
  npx mandark ask <github-url1> <github-url2> ... "Your question here"
  npx mandark pipe <github-url1> <github-url2> ... | another-command
  npx mandark copy <github-url1> <github-url2> ...

Options:
  --include-imports, -a    Include import statements in the code
  --print, -p              Save processed code to compiled-code.txt and exit
  --copy, -c               Copy processed code to clipboard and exit
  --no-line-numbers, -n    Don't add line numbers to the code
  --pattern=<glob>         Specify the glob pattern for file types (default: **/*.{ts,tsx,js,jsx,mjs,cjs,py,rs,go,c,cpp,h,hpp,java,rb,php,cs,swift,kt,scala,sh,md,json,yaml,yml,html,css,scss,less,txt})
  --help, -h               Show this help message

Models:
`;
  console.log(helpText);
  listAvailableModels();
}

async function main() {
  let inputs = process.argv.slice(2);

  // Show help if no arguments or help flag is present
  if (
    inputs.length === 0 ||
    inputs.includes("--help") ||
    inputs.includes("-h")
  ) {
    displayHelp();
    return;
  }

  if (inputs[0] === "revert") {
    revertLastChanges();
    return;
  }

  let includeImports = false;
  let printCodeAndExit = false;
  let copyToClipboard = false;
  let noLineNumbers = false;
  let filePattern: string | undefined = undefined;

  // Parse special arguments
  inputs = inputs.filter((input) => {
    if (input === "--include-imports" || input === "-a") {
      includeImports = true;
      return false;
    }
    if (input === "--print" || input === "-p") {
      printCodeAndExit = true;
      return false;
    }
    if (input === "--copy" || input === "-c") {
      copyToClipboard = true;
      return false;
    }
    if (input === "--no-line-numbers" || input === "-n") {
      noLineNumbers = true;
      return false;
    }
    if (input.startsWith("--pattern=")) {
      filePattern = input.slice("--pattern=".length);
      return false;
    }
    if (input === "--help" || input === "-h") {
      displayHelp();
      process.exit(0);
    }
    return true;
  });

  // Handle new modes: ask, copy, pipe
  if (inputs[0] === "ask") {
    const githubUrls = inputs.slice(1).filter(extractGitHubUrl);
    const question = inputs.slice(githubUrls.length + 1).join(" ");

    if (githubUrls.length === 0 || !question) {
      console.error(
        'Usage: npx mandark ask <github-url1> <github-url2> ... "Your question here"'
      );
      process.exit(1);
    }
    let combinedCode = "";
    for (const url of githubUrls) {
      const processedFiles = await processFiles(
        [url],
        includeImports,
        noLineNumbers,
        filePattern
      );
      combinedCode += processedFiles.code;
    }

    const selectedModel = models[0]; // Default model for ask
    await checkAndSetAPIKey(selectedModel);

    const answerStream = askAI(
      combinedCode,
      question,
      selectedModel.name,
      selectedModel.provider
    );
    for await (const chunk of answerStream) {
      process.stdout.write(chunk);
    }
    console.log("\n");
    return;
  }

  if (inputs[0] === "copy") {
    const githubUrls = inputs.slice(1).filter(extractGitHubUrl);
    if (githubUrls.length === 0) {
      console.error("Usage: npx mandark copy <github-url1> <github-url2> ...");
      process.exit(1);
    }
    let combinedCode = "";
    for (const url of githubUrls) {
      const processedFiles = await processFiles(
        [url],
        includeImports,
        noLineNumbers,
        filePattern
      );
      combinedCode += processedFiles.code;
    }
    await import("clipboardy").then((clipboardy) =>
      clipboardy.default.writeSync(combinedCode)
    );
    console.log("Line tagged code copied to clipboard");
    return;
  }

  if (inputs[0] === "pipe") {
    const githubUrls = inputs.slice(1).filter(extractGitHubUrl);
    if (githubUrls.length === 0) {
      console.error(
        "Usage: npx mandark pipe <github-url1> <github-url2> ... | another-command"
      );
      process.exit(1);
    }

    let combinedCode = "";
    for (const url of githubUrls) {
      const processedFiles = await processFiles(
        [url],
        includeImports,
        noLineNumbers,
        filePattern
      );
      combinedCode += processedFiles.code;
    }
    process.stdout.write(combinedCode);
    return;
  }

  const modelNickname = inputs.pop()!;
  let selectedModel = models.find((model) => model.nickName === modelNickname);

  if (!selectedModel) {
    if (modelNickname) inputs.push(modelNickname);
    selectedModel = models[0];
  }

  if (inputs.length === 0) {
    console.error("Problem: No files or folders to process");
    process.exit(1);
  }

  const processedFiles = await processFiles(
    inputs,
    includeImports,
    noLineNumbers,
    filePattern
  );

  if (printCodeAndExit || copyToClipboard) {
    if (printCodeAndExit) {
      fs.writeFileSync("compiled-code.txt", processedFiles.code);
      console.log("Line tagged code saved to compiled-code.txt");
    }
    if (copyToClipboard) {
      await import("clipboardy").then((clipboardy) =>
        clipboardy.default.writeSync(processedFiles.code)
      );
      console.log("Line tagged code copied to clipboard");
    }
    process.exit(0);
  }

  console.log("\n\nWelcome to Mandark!");

  listAvailableModels();

  console.log(
    `Selected model: ${selectedModel.nickName} (${selectedModel.name} from ${selectedModel.provider})\n`
  );

  await checkAndSetAPIKey(selectedModel);

  const estimatedTokens = countTokens(
    processedFiles.code + taskPrompt("x".repeat(100))
  );

  const overflowCheck = checkContextWindowOverflow(
    estimatedTokens,
    selectedModel
  );
  if (overflowCheck.overflow) {
    console.log(
      chalk.yellow(
        `Warning: Input exceeds model's context window by ${
          overflowCheck.overflowTokens
        } tokens (${overflowCheck.overflowPercentage?.toFixed(2)}%).`
      )
    );
    const continueAnyway = await confirm({
      message:
        "Do you want to continue anyway? (This may result in incomplete processing)",
      default: false,
    });
    if (!continueAnyway) {
      console.log("Please reduce the input size and try again.");
      process.exit(0);
    }
  }

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
    const verifiedEditStream = await verifyEditStream(
      editPacketStream,
      checkAPIKey(preferredVerifierModel.provider)
        ? preferredVerifierModel.provider
        : selectedModel.provider
    );
    await editProcessor.processEditStream(verifiedEditStream);
  }

  console.log(
    chalk.cyan(
      "Leave a star if you like it! https://github.com/hrishioa/mandark"
    )
  );
}

main().catch(console.error);
