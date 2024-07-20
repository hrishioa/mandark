import { getAIEditsFromClaude } from "./call-ai-claude";
import { getAIEditsFromGPT } from "./call-ai-gpt";
import { processFiles } from "./process-files";
import { input } from "@inquirer/prompts";
import fs from "node:fs";
import { EditProcessor } from "./edit-processor";

async function main() {
  console.log("Starting the program execution...");
  let inputs = process.argv.slice(2);
  const printCodeAndExit = inputs.includes("-p");
  inputs = inputs.filter((input) => !input.startsWith("-"));
  if (inputs.length === 0) {
    console.error(
      "Please provide at least one input file or directory. Switches (-p to print the compiled code and exit.)"
    );
    process.exit(1);
  }

  const processedFiles = await processFiles(inputs);

  if (printCodeAndExit) {
    fs.writeFileSync("compiled-code.txt", processedFiles.code);
    process.exit(0);
  }

  console.log("Loaded ", processedFiles.count, " files.");

  const task = await input({
    message: "What do you need me to do?",
    validate: (input: string) => input.trim() !== "" || "Task cannot be empty",
  });

  // const editPacketStream = await getAIEditsFromClaude(
  //   processedFiles.code,
  //   task,
  //   "claude-3-5-sonnet-20240620"
  // );
  const editPacketStream = await getAIEditsFromGPT(
    processedFiles.code,
    task,
    "gpt-4o-mini"
  );

  const editProcessor = new EditProcessor();
  await editProcessor.processEditStream(editPacketStream);

  //   for await (const editPacket of editPacketStream) {
  //     if (editPacket.type === "edit") {
  //       console.log("Edit found:", editPacket.edit);
  //     } else if (editPacket.type === "alledits") {
  //       console.log("DONE!");

  //       for (const edit of editPacket.edits) {
  //         await applyEdit(edit);
  //       }
  //     }
  // console.log('Processing of files completed.');
  //   }
}

main();
