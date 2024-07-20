export type Edits = {
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
      };
  code: string; // Code to insert or replace
  newPackages?: string[]; // Does this code need new packages to be installed?
}[];
