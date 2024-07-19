import fs from "fs";
import path from "path";
import chalk from "chalk";
import { Edits } from "./edit-type";
import { confirm } from "@inquirer/prompts";

function printColoredDiff(
  oldLines: string[],
  newLines: string[],
  startLine: number,
  endLine: number
) {
  const padding = 3; // Number of lines to show before and after the change

  for (
    let i = Math.max(0, startLine - padding);
    i < Math.min(oldLines.length, endLine + padding);
    i++
  ) {
    if (i >= startLine && i < endLine) {
      console.log(chalk.red(`- ${oldLines[i]}`));
    } else if (i >= startLine - padding && i < startLine) {
      console.log(`  ${oldLines[i]}`);
    }
  }

  for (const newLine of newLines) {
    console.log(chalk.green(`+ ${newLine}`));
  }

  for (let i = endLine; i < Math.min(oldLines.length, endLine + padding); i++) {
    console.log(`  ${oldLines[i]}`);
  }
}

export async function applyEdit(edit: Edits[number]): Promise<boolean> {
  const filePath = path.resolve(process.cwd(), edit.filename);
  let fileContent: string[];

  try {
    fileContent = fs.readFileSync(filePath, "utf-8").split("\n");
  } catch (error) {
    if (edit.type.type === "addition" && !fs.existsSync(filePath)) {
      fileContent = [];
    } else {
      console.error(`Error reading file ${edit.filename}:`, error);
      return false;
    }
  }

  let startLine: number, endLine: number;
  let newContent: string[];

  switch (edit.type.type) {
    case "addition":
      startLine = edit.type.atLine - 1;
      endLine = startLine;
      newContent = edit.code.split("\n");
      break;
    case "replacement":
      startLine = edit.type.fromLineNumber - 1;
      endLine = edit.type.toLineNumber;
      newContent = edit.code.split("\n");
      break;
    case "npm_install":
      console.log(`Installing npm package: ${edit.type.packageName}`);
      // You might want to implement the actual npm install logic here
      return true;
    default:
      console.error("Unknown edit type");
      return false;
  }

  console.log(`\n\nChange: ${edit.explain}\n`);

  console.log("Diff for ", edit.filename, "\n");
  printColoredDiff(fileContent, newContent, startLine, endLine);

  const userResponse = await confirm({
    message: "\nDo you want to apply this change?",
    default: true,
  });

  if (userResponse) {
    const updatedContent = [
      ...fileContent.slice(0, startLine),
      ...newContent,
      ...fileContent.slice(endLine),
    ];

    fs.writeFileSync(filePath, updatedContent.join("\n"));
    console.log("Change applied successfully.");
    return true;
  } else {
    console.log("Change discarded.");
    return false;
  }
}
