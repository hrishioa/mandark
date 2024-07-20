<h1 align="center">
      <br>
  <a href="https://github.com/hrishioa/drick"><img src="https://github.com/user-attachments/assets/9f89b648-932b-405c-940f-b423d93d1a23" alt="mandark" width="200"></a>
  <br>
  <code>npx mandark &lt;folder or file&gt;</code>
  <br>
</h1>

<h3 align="center">Mandark is a bog-simple (~80kb) AI intern that can do a lot, including building himself.</h3>

## Features

- Run without installation
- Supports Claude-3.5 Sonnet, Haiku, GPT-4o-mini and GPT-4-turbo
- Edit and create multiple files
- Verify diffs from the command line
- Install new packages as needed
- Token and cost estimation **before execution**
- Works with any codebase

## Usage

Run mandark with:

```bash
npx mandark folder1 file1 folder2 <-a> <-p> <modelName>
```

- `[folder1]`, `[file1]`, `[file2]`, etc.: Paths to individual files or folders you want to process
- `[modelName]`: (Optional) Nickname of the AI model to use (e.g., 'sonnet35', 'haiku', '4omini', '4turbo')
- - `-p`: Print the line-tagged compiled code to a file and exit. Useful if you want to copy-paste into other assistants.
- `-a`: Include import statements when processing files. This is skipped by default to save tokens.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. TODO.md is a good place to start.
