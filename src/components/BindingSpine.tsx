import type { ReactNode } from "react";

export type BindingSpineStep = {
  body?: ReactNode;
  description: ReactNode;
  state: "active" | "complete" | "upcoming";
  title: ReactNode;
};

export function BindingSpine({ steps }: { steps: BindingSpineStep[] }) {
  return (
    <ol className="binding-spine">
      {steps.map((step, index) => (
        <li className={`binding-spine-step is-${step.state}`} key={index}>
          <span className="binding-spine-node">{step.state === "complete" ? <span className="material-symbols-outlined">check</span> : index + 1}</span>
          <div className="binding-spine-copy">
            <strong>{step.title}</strong>
            <small>{step.description}</small>
            <div className="binding-spine-expansion" aria-hidden={step.state !== "active"}>
              <div>{step.state === "active" ? step.body : null}</div>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
