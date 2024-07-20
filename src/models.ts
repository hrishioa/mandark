export const models: {
  name: string;
  provider: "anthropic" | "openai";
  nickName: string;
  outputCPM: number;
  inputCPM: number;
  outputLength: number;
}[] = [
  {
    name: "claude-3-5-sonnet-20240620",
    provider: "anthropic",
    nickName: "sonnet35",
    outputCPM: 15,
    inputCPM: 3,
    outputLength: 8092,
  },
  {
    name: "claude-3-haiku-20240307",
    provider: "anthropic",
    nickName: "haiku",
    outputCPM: 1.25,
    inputCPM: 0.25,
    outputLength: 4096,
  },
  {
    name: "gpt-4o-mini",
    provider: "openai",
    nickName: "4omini",
    outputCPM: 0.6,
    inputCPM: 0.15,
    outputLength: 16384,
  },
];
