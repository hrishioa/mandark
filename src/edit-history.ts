import fs from 'fs';
import path from 'path';
import { Edits } from './types';
import { confirm } from '@inquirer/prompts';

const HISTORY_FILE = 'mandark-history.json';

interface FileHistory {
  filename: string;
  edits: Edits;
  fullContent: string;
}

export function saveEdits(edits: Edits): void {
  const historyPath = path.join(process.cwd(), HISTORY_FILE);
  let history: FileHistory[] = [];

  if (fs.existsSync(historyPath)) {
    const historyContent = fs.readFileSync(historyPath, 'utf-8');
    history = JSON.parse(historyContent);
  }

  const fileMap = new Map<string, FileHistory>();

  for (const edit of edits) {
    if (!fileMap.has(edit.filename)) {
      fileMap.set(edit.filename, {
        filename: edit.filename,
        edits: [],
        fullContent: fs.existsSync(edit.filename) ? fs.readFileSync(edit.filename, 'utf-8') : ''
      });
    }
    fileMap.get(edit.filename)!.edits.push(edit);
  }

  history.push(...Array.from(fileMap.values()));
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
}

export async function revertLastChanges(): Promise<void> {
  const historyPath = path.join(process.cwd(), HISTORY_FILE);
  if (!fs.existsSync(historyPath)) {
    console.log('No history file found. Nothing to revert.');
    return;
  }

  const historyContent = fs.readFileSync(historyPath, 'utf-8');
  const history: FileHistory[] = JSON.parse(historyContent);

  if (history.length === 0) {
    console.log('No changes to revert.');
    return;
  }

  const lastChanges = history.pop()!;
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));

  for (const fileHistory of lastChanges) {
    if (fs.existsSync(fileHistory.filename)) {
      if (fileHistory.fullContent === '') {
        const shouldDelete = await confirm({
          message: `Do you want to delete the newly created file: ${fileHistory.filename}?`,
          default: false
        });
        if (shouldDelete) {
          fs.unlinkSync(fileHistory.filename);
          console.log(`Deleted file: ${fileHistory.filename}`);
        } else {
          console.log(`File ${fileHistory.filename} was not deleted.`);
        }
      } else {
        fs.writeFileSync(fileHistory.filename, fileHistory.fullContent);
        console.log(`Reverted changes in: ${fileHistory.filename}`);
      }
    } else {
      console.log(`File not found: ${fileHistory.filename}`);
    }
  }

  console.log('Last changes have been reverted.');
}

