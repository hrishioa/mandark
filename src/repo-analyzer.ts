import fs from "node:fs";
import path from "node:path";

interface DirAnalysis {
  path: string;
  score: number;
}

const COMMON_SOURCE_DIRS = ["src", "lib", "source", "app"];
const IGNORE_DIRS = [
  "test",
  "tests",
  "node_modules",
  ".git",
  "build",
  "dist",
  "coverage",
];

export function analyzeRepoStructure(repoPath: string): string[] {
  const sourceDirs: DirAnalysis[] = [];

  function exploreDirectory(dirPath: string, depth = 0): void {
    if (depth > 3) return; // Limit depth to avoid excessive recursion

    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      if (!fs.statSync(fullPath).isDirectory()) continue;

      // Skip ignored directories
      if (IGNORE_DIRS.includes(item)) continue;

      let score = 0;

      // Boost score for common source directory names
      if (COMMON_SOURCE_DIRS.includes(item)) {
        score += 10;
      }

      // Check for presence of source files
      const hasSourceFiles = fs
        .readdirSync(fullPath)
        .some(
          (file) =>
            file.endsWith(".ts") ||
            file.endsWith(".js") ||
            file.endsWith(".tsx")
        );

      if (hasSourceFiles) {
        score += 5;
      }

      if (score > 0) {
        sourceDirs.push({
          path: fullPath,
          score,
        });
      }

      exploreDirectory(fullPath, depth + 1);
    }
  }

  exploreDirectory(repoPath);

  // Sort by score and return paths
  return sourceDirs.sort((a, b) => b.score - a.score).map((dir) => dir.path);
}
