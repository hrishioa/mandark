export const models: {
  name: string;
  provider: "anthropic" | "openai" | "fireworks";
  nickName: string;
  outputCPM: number;
  inputCPM: number;
  outputLength: number;
  contextWindow: number;
  verifyModel?: boolean;
}[] = [
  {
    name: "claude-3-5-sonnet-20240620",
    provider: "anthropic",
    nickName: "sonnet35",
    outputCPM: 15,
    inputCPM: 3,
    outputLength: 8092,
    contextWindow: 200000,
    // verifyModel: true,
  },
  {
    name: "claude-3-haiku-20240307",
    provider: "anthropic",
    nickName: "haiku",
    outputCPM: 1.25,
    inputCPM: 0.25,
    outputLength: 4096,
    contextWindow: 200000,
    verifyModel: true,
  },
  {
    name: "gpt-4o-mini",
    provider: "openai",
    nickName: "4omini",
    outputCPM: 0.6,
    inputCPM: 0.15,
    outputLength: 16384,
    contextWindow: 128000,
    verifyModel: true,
  },
  {
    name: "gpt-4-turbo",
    provider: "openai",
    nickName: "4turbo",
    outputCPM: 30,
    inputCPM: 10,
    outputLength: 4096,
    contextWindow: 128000,
  },
  {
    name: "accounts/fireworks/models/llama-v3p1-405b-instruct",
    provider: "fireworks",
    nickName: "llama405b",
    outputCPM: 3,
    inputCPM: 3,
    outputLength: 16384,
    contextWindow: 262144,
  },
];

export const preferredVerifierModel = models.find(
  (model) => model.nickName === "4omini"
)!;
