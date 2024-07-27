import fs from 'fs';
import path from 'path';
import { Edits } from './types';

const HISTORY_FILE = 'mandark-history.json';

export function saveEdits(edits: Edits): void {
  const historyPath = path.join(process.cwd(), HISTORY_FILE);
  let history: Edits[] = [];

  if (fs.existsSync(historyPath)) {
    const historyContent = fs.readFileSync(historyPath, 'utf-8');
    history = JSON.parse(historyContent);
  }

  history.push(edits);
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
}

export function revertLastChanges(): void {
  const historyPath = path.join(process.cwd(), HISTORY_FILE);
  if (!fs.existsSync(historyPath)) {
    console.log('No history file found. Nothing to revert.');
    return;
  }

  const historyContent = fs.readFileSync(historyPath, 'utf-8');
  const history: Edits[] = JSON.parse(historyContent);

  if (history.length === 0) {
    console.log('No changes to revert.');
    return;
  }

  const lastEdits = history.pop()!;
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));

  for (const edit of lastEdits.reverse()) {
    if (fs.existsSync(edit.filename)) {
      const content = fs.readFileSync(edit.filename, 'utf-8').split('\n');

      if (edit.change.type === 'addition') {
        content.splice(edit.change.atLine - 1, edit.code.split('\n').length);
      } else if (edit.change.type === 'replacement') {
        content.splice(
          edit.change.fromLineNumber - 1,
          edit.change.toLineNumber - edit.change.fromLineNumber + 1,
          ...edit.code.split('\n')
        );
      }

      if (content.length === 0) {
        fs.unlinkSync(edit.filename);
        console.log(`Deleted file: ${edit.filename}`);
      } else {
        fs.writeFileSync(edit.filename, content.join('\n'));
        console.log(`Reverted changes in: ${edit.filename}`);
      }
    } else {
      console.log(`File not found: ${edit.filename}`);
    }
  }

  console.log('Last changes have been reverted.');
}
