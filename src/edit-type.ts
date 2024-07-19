type Edits = {
  explain: string; // explain what you want to do and why you're making this change.
  filename: string;
  type:
    | {
        type: "addition";
        atLine: number;
      }
    | {
        type: "replacement";
        fromLineNumber: number;
        toLineNumber: number;
      }
    | {
        type: "npm_install"; // npm package to install
        packageName: string;
      };
  code: string; // Code to insert or replace
}[];
