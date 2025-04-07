import fs from "node:fs";
import path from "node:path";
import fastGlob from "fast-glob";
import { extractGitHubUrl, cloneOrUpdateRepo } from "./github-utils";

// Default glob pattern for code files
const DEFAULT_FILE_PATTERN =
  "**/*.{ts,tsx,js,jsx,mjs,cjs,py,rs,go,c,cpp,h,hpp,java,rb,php,cs,swift,kt,scala,sh,md,json,yaml,yml,html,css,scss,less,txt}";

export async function processFiles(
  inputs: string[],
  includeImports: boolean,
  noLineNumbers: boolean = false,
  filePattern: string = DEFAULT_FILE_PATTERN
): Promise<{
  code: string;
  count: number;
}> {
  const allFiles: string[] = [];

  for (const input of inputs) {
    const githubUrl = extractGitHubUrl(input);

    if (githubUrl) {
      const repoInfo = cloneOrUpdateRepo(githubUrl);

      // First, check for README
      const readmePath = path.join(repoInfo.path, "README.md");
      if (fs.existsSync(readmePath)) {
        allFiles.push(readmePath);
      }

      if (repoInfo.sourceDirs.length > 0) {
        // If we found source directories, only search in those
        for (const sourceDir of repoInfo.sourceDirs) {
          const files = await fastGlob(`${sourceDir}/${filePattern}`, {
            absolute: true,
            ignore: ["**/node_modules/**", "**/.git/**"],
          });
          allFiles.push(...files);
        }
      } else {
        // Fallback to searching the entire repo if no source dirs found
        const files = await fastGlob(`${repoInfo.path}/${filePattern}`, {
          absolute: true,
          ignore: [
            "**/node_modules/**",
            "**/.git/**",
            "**/test/**",
            "**/tests/**",
            "**/dist/**",
            "**/build/**",
          ],
        });
        allFiles.push(...files);
      }
      continue;
    }
    const stat = fs.statSync(input);
    if (stat.isDirectory()) {
      const files = await fastGlob(`${input}/${filePattern}`, {
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

  let combinedCode = "";
  for (const file of allFiles) {
    combinedCode += await loadNumberedFile(file, includeImports, noLineNumbers);
  }

  return {
    code: combinedCode,
    count: allFiles.length,
  };
}

export async function loadNumberedFile(
  filePath: string,
  includeImports: boolean,
  noLineNumbers: boolean = false
): Promise<string> {
  const content = fs.readFileSync(filePath, "utf-8");
  let processedContent = noLineNumbers
    ? content
    : content
        .split("\n")
        .map((line, index) => `L${index + 1}: ${line}`)
        .join("\n");

  if (!includeImports) {
    if (noLineNumbers) {
      processedContent = processedContent
        .replace(/import.*?;?\n/g, "")
        .replace(/import.*?{[\s\S]*?}\n/g, "");
    } else {
      processedContent = processedContent
        .replace(/L\d+:\s*import.*?;?\n/g, "")
        .replace(/L\d+:\s*import.*?{[\s\S]*?}\n/g, "");
    }
  }

  // Get relative path to file
  const relativePath = path.relative(process.cwd(), filePath);

  return `<${relativePath}>\n${processedContent}\n</${relativePath}>\n\n`;
}
