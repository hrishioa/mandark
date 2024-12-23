<h1 align="center">
      <br>
  <a href="https://github.com/hrishioa/mandark"><img src="https://github.com/user-attachments/assets/9f89b648-932b-405c-940f-b423d93d1a23" alt="mandark" width="200"></a>
  <br>
  <code>npx mandark &lt;folder or file&gt;</code>
  <br>
</h1>

<h3 align="center">Mandark is a bog-simple (~80kb) AI intern that can do a lot, including building himself.</h3>

https://github.com/user-attachments/assets/f3aff778-0839-4bb2-9fe3-c8c6b98434a5

## Features

-   Run without installation
-   **Ask questions about code:** `npx mandark ask <github-url1> <github-url2> ... "Your question here"`
-   **Copy code to clipboard:** `npx mandark copy <github-url1> <github-url2> ...`
-   **Pipe code to another command:** `npx mandark pipe <github-url1> <github-url2> ... | another-command`
-   Supports Claude-3.5 Sonnet, Haiku, GPT-4o-mini and GPT-4-turbo (now with llama405b from Fireworks)
-   Edit and create multiple files
-   Verify diffs from the command line
-   Install new packages as needed
-   Token and cost estimation **before execution**
-   Works with any codebase

## Usage

Run mandark with:

```bash
npx mandark folder1 file1 folder2 <-a> <-p> <modelName>
```

or

```bash
npx mandark ask <github-url1> <github-url2> ... "Your question here"
npx mandark copy <github-url1> <github-url2> ...
npx mandark pipe <github-url1> <github-url2> ... | another-command
```

-   `[folder1]`, `[file1]`, `[file2]`, etc.: Paths to individual files or folders you want to process
-   `<github-url1> <github-url2> ...`: One or more GitHub repository URLs.
-   `[modelName]`: (Optional) Nickname of the AI model to use (e.g., 'sonnet35', 'haiku', '4omini', '4turbo', 'llama405b'). Defaults to the first model if not provided.
-   `-p`: Print the line-tagged compiled code to a file and exit. Useful if you want to copy-paste into other assistants.
-   `-c`: Copy the line-tagged compiled code to the clipboard and exit.
-   `-a`: Include import statements when processing files. This is skipped by default to save tokens.

### New Modes:

-   **`ask` mode:**  Allows you to ask a question about one or more GitHub repositories. The response will be streamed to your console.
    ```bash
    npx mandark ask https://github.com/hrishioa/mandark "What does the verifyEdit function do?"
    npx mandark ask https://github.com/hrishioa/mandark https://github.com/vercel/next.js "What is the main purpose of the app.ts file in each of these repos?"
    ```
-   **`copy` mode:** Copies the combined, line-tagged code from one or more GitHub repositories to your clipboard.
    ```bash
    npx mandark copy https://github.com/hrishioa/mandark
    npx mandark copy https://github.com/hrishioa/mandark https://github.com/vercel/next.js
    ```
-   **`pipe` mode:** Pipes the combined, line-tagged code from one or more GitHub repositories to stdout, allowing you to use it with other commands.
    ```bash
    npx mandark pipe https://github.com/hrishioa/mandark | wc -l
    npx mandark pipe https://github.com/hrishioa/mandark https://github.com/vercel/next.js | grep "L1:"
    ```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. `TODO.md` is a good place to start.
