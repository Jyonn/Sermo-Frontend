import {useEffect,useState} from 'react';
import {SelectControl} from './SettingRow';

/** Shared picker with a hidden value for ordinary FormData-based forms. */
export function FormSelectField({name,label,initialValue,options,disabled=false}:{name:string;label:string;initialValue:string;options:Array<{value:string;label:string}>;disabled?:boolean}){
  const [value,setValue]=useState(initialValue);
  useEffect(()=>setValue(initialValue),[initialValue]);
  return <div><SelectControl label={label} value={value} options={options} onChange={setValue} disabled={disabled}/><input type="hidden" name={name} value={value}/></div>;
}
