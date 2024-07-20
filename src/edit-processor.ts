import fs from "fs";
import path from "path";
import { confirm } from "@inquirer/prompts";
import chalk from "chalk";
import { Edits } from "./edit-type";

class FileManager {
  private files: Map<string, string[]> = new Map();

  loadFile(filePath: string): void {
    const absolutePath = path.resolve(process.cwd(), filePath);
    if (!this.files.has(absolutePath)) {
      try {
        const content = fs.readFileSync(absolutePath, "utf-8").split("\n");
        this.files.set(absolutePath, content);
      } catch (error) {
        if (!fs.existsSync(absolutePath)) {
          this.files.set(absolutePath, []);
        } else {
          console.error(`Error reading file ${filePath}:`, error);
        }
      }
    }
  }

  getFileContent(filePath: string): string[] {
    const absolutePath = path.resolve(process.cwd(), filePath);
    return this.files.get(absolutePath) || [];
  }

  updateFile(filePath: string, newContent: string[]): void {
    const absolutePath = path.resolve(process.cwd(), filePath);
    this.files.set(absolutePath, newContent);
  }

  saveAllFiles(): void {
    for (const [filePath, content] of this.files.entries()) {
      fs.writeFileSync(filePath, content.join("\n"));
    }
    console.log("All changes have been saved.");
  }
}

export class EditProcessor {
  private fileManager: FileManager;

  constructor() {
    this.fileManager = new FileManager();
  }

  async processEditStream(
    editStream: AsyncGenerator<any, void, undefined>
  ): Promise<void> {
    for await (const editPacket of editStream) {
      if (editPacket.type === "edit") {
        await this.processEdit(editPacket.edit);
      } else if (editPacket.type === "alledits") {
        console.log("All edits processed.");
        this.fileManager.saveAllFiles();
      } else if (editPacket.type === "error") {
        // Ask the user if they still want to apply edits
        const userResponse = await confirm({
          message: `\nError further edits: ${editPacket.error}\nDo you want to apply already confirmed edits?`,
          default: true,
        });

        if (userResponse) {
          this.fileManager.saveAllFiles();
        }
      }
    }
  }

  private async processEdit(edit: Edits[number]): Promise<void> {
    this.fileManager.loadFile(edit.filename);
    const fileContent = this.fileManager.getFileContent(edit.filename);

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
      default:
        console.error("Unknown edit type");
        return;
    }

    console.log(`\n\nChange: ${edit.explain}\n`);
    console.log(`Diff for ${edit.filename}:\n`);
    this.printColoredDiff(fileContent, newContent, startLine, endLine);

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
      this.fileManager.updateFile(edit.filename, updatedContent);
      console.log("Change applied in memory.");
    } else {
      console.log("Change discarded.");
    }
  }

  private printColoredDiff(
    oldLines: string[],
    newLines: string[],
    startLine: number,
    endLine: number
  ): void {
    const padding = 3;

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

    for (
      let i = endLine;
      i < Math.min(oldLines.length, endLine + padding);
      i++
    ) {
      console.log(`  ${oldLines[i]}`);
    }
  }
}
