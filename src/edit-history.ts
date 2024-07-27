import fs from "fs";
import path from "path";
import { Edits } from "./types";
import { confirm } from "@inquirer/prompts";

const HISTORY_FILE = "mandark-history.json";

interface FileHistory {
  filename: string;
  originalContent: string;
  edits: Edits;
}

export function saveEdits(edits: Edits): void {
  const historyPath = path.join(process.cwd(), HISTORY_FILE);
  let history: FileHistory[] = [];

  if (fs.existsSync(historyPath)) {
    const historyContent = fs.readFileSync(historyPath, "utf-8");
    history = JSON.parse(historyContent);
  }

  for (const edit of edits) {
    const existingFileHistory = history.find(
      (h) => h.filename === edit.filename
    );
    if (existingFileHistory) {
      existingFileHistory.edits.push(edit);
    } else {
      const originalContent = fs.existsSync(edit.filename)
        ? fs.readFileSync(edit.filename, "utf-8")
        : "";
      history.push({
        filename: edit.filename,
        originalContent,
        edits: [edit],
      });
    }
  }

  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
}

export async function revertLastChanges(): Promise<void> {
  const historyPath = path.join(process.cwd(), HISTORY_FILE);
  if (!fs.existsSync(historyPath)) {
    console.log("No history file found. Nothing to revert.");
    return;
  }

  const historyContent = fs.readFileSync(historyPath, "utf-8");
  const history: FileHistory[] = JSON.parse(historyContent);

  if (history.length === 0) {
    console.log("No changes to revert.");
    return;
  }

  console.log("Recent changes:");
  history.forEach((fileHistory, index) => {
    console.log(
      `${index + 1}. ${fileHistory.filename} (${
        fileHistory.edits.length
      } edits)`
    );
  });

  const userResponse = await confirm({
    message: "Do you want to revert all changes?",
    default: false,
  });

  if (userResponse) {
    for (const fileHistory of history) {
      if (fileHistory.originalContent === "") {
        // This was a newly created file, so we should delete it
        if (fs.existsSync(fileHistory.filename)) {
          fs.unlinkSync(fileHistory.filename);
          console.log(`Deleted file: ${fileHistory.filename}`);
        }
      } else {
        // This was an existing file, so we should restore its original content
        fs.writeFileSync(fileHistory.filename, fileHistory.originalContent);
        console.log(`Reverted changes in: ${fileHistory.filename}`);
      }
    }

    // Clear the history file
    fs.writeFileSync(historyPath, "[]");
    console.log("All changes have been reverted and history has been cleared.");
  } else {
    console.log("Revert operation cancelled.");
  }
}
