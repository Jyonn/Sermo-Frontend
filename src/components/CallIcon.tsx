export function CallIcon({ended=false,className=''}:{ended?:boolean;className?:string}) {
  return <svg className={`call-icon ${className}`.trim()} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={ended?'M3 15v-3c5-5 13-5 18 0v3h-5v-3a13 13 0 0 0-8 0v3H3Z':'M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 2a15 15 0 0 1-7-7l2-2-2-5Z'}/>
  </svg>;
}
