import {
  checkEconomyConventions,
  type ConventionCheckResult,
  type ConventionViolation,
} from "../../../src/economy-conventions";
import type { EconomyDocument } from "./document";

export type { ConventionCheckResult, ConventionViolation };

export function checkReleaseReadiness(
  document: EconomyDocument,
): ConventionCheckResult {
  return checkEconomyConventions(document);
}

export function assertReleaseReady(
  document: EconomyDocument,
): EconomyDocument {
  const result = checkReleaseReadiness(document);
  if (!result.ready) {
    const details = result.violations
      .map((violation) => `- [${violation.code}] ${violation.message}`)
      .join("\n");
    throw new Error(
      `This diagram is not ready to release. Fix these economy conventions:\n${details}`,
    );
  }
  return document;
}
