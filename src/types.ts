import { z } from "zod";

const EditTypeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("addition"),
    atLine: z.number(),
  }),
  z.object({
    type: z.literal("replacement"),
    fromLineNumber: z.number(),
    toLineNumber: z.number(),
  }),
]);

export const EditSchema = z.object({
  explain: z.string(),
  filename: z.string(),
  change: EditTypeSchema,
  code: z.string(),
  newPackages: z.array(z.string()).optional(),
});

export type EditPackets =
  | { type: "edit"; edit: Edits[number] }
  | { type: "error"; error: string }
  | {
      type: "alledits";
      edits: Edits;
    };

export type AIEditGenerator = AsyncGenerator<EditPackets, void, undefined>;

export type Edits = {
  explain: string; // explain what you want to do and why you're making this change.
  filename: string;
  change:
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

export const EditTypeStr = `export type Edits = {
  explain: string; // explain what you want to do and why you're making this change.
  filename: string;
  change:
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
`;

// Edit correction

export type CorrectedEditChange =
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
      type: "skip";
    };

export const CorrectedEditChangeTypeStr = `type CorrectedEditChange =
{
    reason: string; // Explain why this change was made, write 'no change' if there's no need for a change
    type: "addition";
    atLine: number;
  } | {
    reason: string;
    type: "replacement";
    fromLineNumber: number;
    toLineNumber: number;
  }  | {
    reason: string;
    type: 'skip' // Means to skip this edit, no need to apply
    };`;

export const CorrectedEditChangeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("addition"),
    atLine: z.number(),
  }),
  z.object({
    type: z.literal("replacement"),
    fromLineNumber: z.number(),
    toLineNumber: z.number(),
  }),
  z.object({
    type: z.literal("skip"),
  }),
]);
