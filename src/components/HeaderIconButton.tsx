import type { ReactNode } from 'react';
import './SquareExperience.css';

export function HeaderIconButton({label,children,onClick,disabled=false}:{
  label:string;children:ReactNode;onClick:()=>void;disabled?:boolean;
}) {
  return <div className="square-header-square-tools"><button className="square-header-tool" type="button" aria-label={label} onClick={onClick} disabled={disabled}>{children}</button></div>;
}
