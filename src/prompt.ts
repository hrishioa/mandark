import { EditTypeStr } from "./types";

export const taskPrompt = (task: string) => `Task: ${task}

Follow this typespec and return ONLY VALID JSON to suggest additions or replacements in files to make this change in this codebase.

Facts:
1. You can provide a new filename to create a file.
2. Leave toLine empty for additions.
3. Make sure the code snippet in the edit is complete. Feel free to make multiple edits, avoid repeating existing code if you can.
4. Ensure the line numbers are accurate. Feel free to repeat existing code from previous or after lines to be sure.

\`\`\`typescript
${EditTypeStr}
\`\`\``;
