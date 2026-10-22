import { ConfirmDialog } from "./ConfirmDialog";
import type { ComponentProps } from "react";

// Irreversible decisions require an explicit button, never an outside click or Escape.
export function AlertDialog(props: Omit<ComponentProps<typeof ConfirmDialog>, "dismissible" | "kind">) {
  return <ConfirmDialog {...props} danger={props.danger ?? true} kind="alert" dismissible={false} />;
}
