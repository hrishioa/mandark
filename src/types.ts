import { z } from "zod";
import { Edits } from "./edit-type";

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
  type: EditTypeSchema,
  code: z.string(),
  newPackages: z.array(z.string()).optional(),
});

export type AIEditGenerator = AsyncGenerator<
  | { type: "edit"; edit: Edits[number] }
  | { type: "error"; error: string }
  | {
      type: "alledits";
      edits: Edits;
    },
  void,
  undefined
>;
