import type { PasswordChangeOptionsDTO } from "../types";

export function meetsPasswordPolicy(password: string, policy: PasswordChangeOptionsDTO["policy"]) {
  const length = Array.from(password).length;
  if (length < policy.min_length || length > policy.max_length) return false;
  if (!policy.official) return true;
  const classes = [/[a-z]/u, /[A-Z]/u, /[0-9]/u, /[^\p{L}\p{N}\s]/u].filter((pattern) => pattern.test(password)).length;
  return classes >= policy.required_classes && !/[\u0000-\u001f\u007f]/u.test(password);
}
