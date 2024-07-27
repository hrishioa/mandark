import fs from "node:fs";
import path from "node:path";
import fastGlob from "fast-glob";

export async function processFiles(
  inputs: string[],
  includeImports: boolean
): Promise<{
  code: string;
  count: number;
}> {
  const allFiles: string[] = [];

  for (const input of inputs) {
    const stat = fs.statSync(input);
    if (stat.isDirectory()) {
      const files = await fastGlob(`${input}/**/*.{ts,tsx,js,py}`, {
        absolute: true,
        ignore: ["**/node_modules/**"],
      });
      allFiles.push(...files);
    } else if (stat.isFile()) {
      allFiles.push(path.resolve(input));
    } else {
      console.warn(`Skipping invalid input: ${input}`);
    }
  }

  const processedContents = (
    await Promise.all(
      allFiles.map((file) => loadNumberedFile(file, includeImports))
    )
  ).join("");

  return {
    code: processedContents,
    count: allFiles.length,
  };
}

export async function loadNumberedFile(
  filePath: string,
  includeImports: boolean
): Promise<string> {
  const content = fs.readFileSync(filePath, "utf-8");
  let processedContent = content
    .split("\n")
    .map((line, index) => `L${index + 1}: ${line}`)
    .join("\n");

  if (!includeImports) {
    processedContent = processedContent
      .replace(/L\d+:\s*import.*?;?\n/g, "")
      .replace(/L\d+:\s*import.*?{[\s\S]*?}\n/g, "");
  }

  // Get relative path to file
  const relativePath = path.relative(process.cwd(), filePath);

  return `<${relativePath}>\n${processedContent}\n</${relativePath}>\n\n`;
}
