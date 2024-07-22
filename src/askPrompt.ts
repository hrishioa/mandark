export const askPrompt = (question: string) =>
  `Use the provided code to answer this question. Use markdown, explain your reasoning, and provide code snippets (place the filename and line numbers above each snippet in the format <path>:<lineNumber>).

Question: ${question}
`;
