/** Calendar-day boundaries in the viewer's timezone, including DST changes. */
export function formatSquareTime(timestampSeconds:number,language:string,yesterday:string,now=new Date()){
  const date=new Date(timestampSeconds*1000);
  if(!Number.isFinite(date.getTime()))return '';
  const day=(value:Date)=>Date.UTC(value.getFullYear(),value.getMonth(),value.getDate())/86400000;
  const age=day(now)-day(date);
  const time=new Intl.DateTimeFormat(language,{hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date);
  if(age===0)return time;
  if(age===1)return `${yesterday} ${time}`;
  if(age>1&&age<7)return `${new Intl.DateTimeFormat(language,{weekday:'short'}).format(date)} ${time}`;
  return new Intl.DateTimeFormat(language,{year:date.getFullYear()===now.getFullYear()?undefined:'numeric',month:'short',day:'numeric'}).format(date);
}
