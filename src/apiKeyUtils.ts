import chalk from "chalk";
import { password } from "@inquirer/prompts";

export function checkAPIKey(provider: string): boolean {
  const envVar = getEnvVarName(provider);
  return !!process.env[envVar];
}

export async function getAndSetAPIKey(provider: string): Promise<string> {
  const envVar = getEnvVarName(provider);
  if (!process.env[envVar]) {
    console.log(chalk.yellow(`\n${envVar} is not set in your environment.`));
    const apiKey = await password({
      message: `Please enter your ${
        provider.charAt(0).toUpperCase() + provider.slice(1)
      } API key:`,
      mask: "*",
    });
    process.env[envVar] = apiKey;
  }
  return process.env[envVar]!;
}

function getEnvVarName(provider: string): string {
  switch (provider) {
    case "anthropic":
      return "ANTHROPIC_API_KEY";
    case "openai":
      return "OPENAI_API_KEY";
    case "fireworks":
      return "FIREWORKS_API_KEY";
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}
