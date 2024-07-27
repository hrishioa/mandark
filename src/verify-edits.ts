import Anthropic from "@anthropic-ai/sdk";
import { models } from "./models";
import {
  CorrectedEditChange,
  CorrectedEditChangeSchema,
  CorrectedEditChangeTypeStr,
  EditPackets,
  Edits,
} from "./types";
import OpenAI from "openai";
import fs from "node:fs";
import { loadNumberedFile } from "./process-files";
import ora from "ora";

// prettier-ignore
const verifyPrompt = (edit: Edits[number]) =>
`Edits:
\`\`\`json
${JSON.stringify(edit, null, 2)}
\`\`\`

Above is an edit to the provided code.
Verify this change:

\`\`\`json
${JSON.stringify(edit.change, null, 2)}
\`\`\`

and make sure it's needed and it's only replacing the correct lines, or adding the code to the correct place. Feel free to change additions to replacements or vice versa, or skip edits if they're not needed.
Return only the fixed change object following this typespec:
\`\`\`typescript
${CorrectedEditChangeTypeStr}
\`\`\`
`

export async function verifyEdit(
  edit: Edits[number],
  fullCode: string,
  preferredProvider: (typeof models)[number]["provider"]
): Promise<Edits[number] | null> {
  let fixedEditJSON: string = "";

  const selectedModel: (typeof models)[number] =
    models.find(
      (model) => model.provider === preferredProvider && model.verifyModel
    ) || models.find((model) => model.verifyModel)!;

  // console.log("Full code: \n", fullCode);

  const verifySpinner = ora(
    "Verifying edit with " + selectedModel.name
  ).start();

  if (selectedModel.provider === "anthropic") {
    // prettier-ignore
    const jsonStart = `{`;
    //   const jsonStart = `{
    // "type": "${edit.change.type}",`;

    const anthropic = new Anthropic();
    const params: any = {
      messages: [
        { role: "user", content: verifyPrompt(edit) },
        {
          role: "assistant",
          content: `\`\`\`\n` + jsonStart,
        },
      ],
      model: selectedModel.name,
      max_tokens: 4096,
      system: `CODE:\n${fullCode}\n`,
    };

    // console.log("params: ", params);

    const response = await anthropic.messages.create(params);

    fixedEditJSON =
      response.content[0].type === "text"
        ? jsonStart + response.content[0].text.split(`\`\`\``)[0]
        : "";
  } else if (selectedModel.provider === "openai") {
    const openai = new OpenAI();

    const response = await openai.chat.completions.create({
      model: selectedModel.name,
      messages: [
        { role: "system", content: `CODE:\n${fullCode}\n` },
        { role: "user", content: verifyPrompt(edit) },
      ],
      response_format: { type: "json_object" },
    });
    if (response.choices[0].message.content)
      fixedEditJSON = response.choices[0].message.content;
  }

  if (!fixedEditJSON) {
    verifySpinner.stop();
    return edit;
  }

  try {
    const fixedEdit: CorrectedEditChange = JSON.parse(fixedEditJSON);
    const verifiedFix: CorrectedEditChange =
      CorrectedEditChangeSchema.parse(fixedEdit);

    if (verifiedFix.type === "skip") {
      // console.log("Skipping edit");
      verifySpinner.stop();
      return null;
    }
    edit.change = verifiedFix;

    // console.log("Verified edit: ", JSON.stringify(verifiedFix, null, 2));
    verifySpinner.stop();
    return edit;
  } catch (error) {
    console.error(
      "Failed to parse Corrected edit:",
      error,
      " in received JSON: ",
      fixedEditJSON
    );
    verifySpinner.stop();
    return edit;
  }
}

export async function* verifyEditStream(
  // TODO: Type this better when we get a chance
  editStream: AsyncGenerator<EditPackets, void, undefined>,
  provider: (typeof models)[number]["provider"]
): AsyncGenerator<EditPackets, void, undefined> {
  for await (const editPacket of editStream) {
    if (editPacket.type === "edit") {
      if (!fs.existsSync(editPacket.edit.filename)) {
        yield { type: "edit", edit: editPacket.edit };
        continue;
      }

      const loadedCode = await loadNumberedFile(editPacket.edit.filename, true);
      const verifiedEdit = await verifyEdit(
        editPacket.edit,
        loadedCode,
        provider
      );
      if (verifiedEdit) yield { type: "edit", edit: verifiedEdit };
    } else {
      yield editPacket;
    }
  }
}
