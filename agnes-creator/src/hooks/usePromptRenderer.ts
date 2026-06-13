import { useMemo } from "react";
import { extractVariables, renderPrompt } from "@/stores/promptStore";
import type { PromptTemplate } from "@/types";

export function usePromptRenderer(template: PromptTemplate | null, variables: Record<string, string>) {
  const extractedVars = useMemo(() => template ? extractVariables(template.content) : [], [template?.content]);
  const rendered = useMemo(() => template ? renderPrompt(template.content, variables) : "", [template?.content, variables]);
  const missingVars = useMemo(() => extractedVars.filter((v) => !variables[v]?.trim()), [extractedVars, variables]);
  return { rendered, missingVars, extractedVars, isValid: missingVars.length === 0 };
}