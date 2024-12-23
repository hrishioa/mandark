import fs from "node:fs";
import path from "node:path";
import { execSync } from "child_process";
import os from "os";
import { analyzeRepoStructure } from "./repo-analyzer";

const REPO_CACHE_DIR = path.join(os.tmpdir(), "mandark-repos");

export function extractGitHubUrl(input: string): string | null {
  const githubUrlRegex =
    /(?:https?:\/\/)?(?:www\.)?github\.com\/([\w-]+)\/([\w.-]+)(?:\.git)?/;
  const match = input.match(githubUrlRegex);
  return match ? match[0] : null;
}

export function getRepoCacheDir(repoUrl: string): string {
  const repoName = repoUrl.split("/").pop()?.replace(".git", "") || "";
  return path.join(REPO_CACHE_DIR, repoName);
}

export interface RepoInfo {
  path: string;
  sourceDirs: string[];
}

export function cloneOrUpdateRepo(repoUrl: string): RepoInfo {
  if (!fs.existsSync(REPO_CACHE_DIR)) {
    fs.mkdirSync(REPO_CACHE_DIR, { recursive: true });
  }

  const repoCacheDir = getRepoCacheDir(repoUrl);

  if (fs.existsSync(repoCacheDir)) {
    console.log(
      `Repository cache exists at ${repoCacheDir}, pulling latest changes...`
    );
    try {
      execSync("git pull", { cwd: repoCacheDir, stdio: "inherit" });
    } catch (error) {
      console.warn("Failed to pull latest changes, using cached version");
    }
  } else {
    console.log(`Cloning repository to ${repoCacheDir}...`);
    execSync(`git clone ${repoUrl} ${repoCacheDir}`, { stdio: "inherit" });
  }

  const sourceDirs = analyzeRepoStructure(repoCacheDir);
  return { path: repoCacheDir, sourceDirs };
}
