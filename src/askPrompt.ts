// prettier-ignore
export const askPrompt = (question: string) =>
`Use the provided code to answer this question. Answer succincty and provide code snippets if needed.

Use this format for code snippets:

===
filePath.ts:123
\`\`\`typescript
// code goes here
\`\`\`
===

Question: ${question}
`;
