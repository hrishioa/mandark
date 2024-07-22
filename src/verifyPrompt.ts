import { Edits, EditTypeStr } from "./types";

// prettier-ignore
export const verifyPrompt = (edit: Edits[number]) =>
`For the provided code, verify this edit to be made for line numbers and content, and return the same or revised edits following this typespec:

\`\`\`typescript
${EditTypeStr}
\`\`\`
`
