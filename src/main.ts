import { getAIEdits } from "./call-ai";
import { processFiles } from "./process-files";
import { input, select } from "@inquirer/prompts";

async function main() {
  console.log("Starting the program execution...");
  const inputs = process.argv.slice(2);
  if (inputs.length === 0) {
    console.error("Please provide at least one input file or directory");
    process.exit(1);
  }

  const processedFiles = await processFiles(inputs);

  console.log("Loaded ", processedFiles.count, " files.");

  const task = await input({
    message: "What do you need me to do?",
    validate: (input: string) => input.trim() !== "" || "Task cannot be empty",
  });

  const editPacketStream = await getAIEdits(
    processedFiles.code,
    task,
    "claude-3-5-sonnet-20240620",
    2
  );

  for await (const editPacket of editPacketStream) {
    if (editPacket.type === "edit") {
      console.log("Edit found:", editPacket.edit);
    }
  }
}

main();
