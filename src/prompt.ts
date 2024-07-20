import { EditTypeStr } from "./types";

export const taskPrompt = (task: string) => `Task: ${task}

Follow this typespec and return ONLY VALID JSON to suggest additions or replacements in files to make this change in this codebase.

Facts:
1. You can provide a new filename to create a file.
2. Leave toLine empty for additions.

\`\`\`typescript
${EditTypeStr}
\`\`\``;
