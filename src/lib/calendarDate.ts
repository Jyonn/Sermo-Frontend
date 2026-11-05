export const FIRST_YEAR=1900;
export const LAST_YEAR=2099;
export const MONTH_COUNT=(LAST_YEAR-FIRST_YEAR+1)*12;
export function calendarDate(year:number,month:number,day:number){return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;}
export function monthIndex(value:string){const [y,m]=value.split('-').map(Number);return Math.max(0,Math.min(MONTH_COUNT-1,(y-FIRST_YEAR)*12+m-1));}
export function monthDays(index:number){const year=FIRST_YEAR+Math.floor(index/12),month=index%12+1;return {year,month,offset:(new Date(year,month-1,1).getDay()+6)%7,count:new Date(year,month,0).getDate()};}
export function defaultDateRange(now=new Date()){
  const year=now.getFullYear(),month=now.getMonth()+1,day=now.getDate();
  const nextMonth=month===12?1:month+1,nextYear=month===12?year+1:year;
  return {from:calendarDate(year,month,day),to:calendarDate(nextYear,nextMonth,Math.min(day,new Date(nextYear,nextMonth,0).getDate()))};
}
