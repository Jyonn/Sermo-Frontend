export type Recurrence={frequency:''|'DAILY'|'WEEKLY'|'MONTHLY'|'YEARLY';interval:number;weekdays:string[];week_start:string;monthly_mode:'day'|'weekday';month_day:number;weekday:string;ordinal:number;year_month?:number;ending:'never'|'until'|'count';until:string;count:number}
export const weekdayCodes=['MO','TU','WE','TH','FR','SA','SU']
export function localDate(value:string,allDay:boolean,zone:string){
 if(allDay)return value.slice(0,10)
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value)),part=(key:string)=>parts.find(p=>p.type===key)!.value
 return `${part('year')}-${part('month')}-${part('day')}`
}
export function recurrenceDefaults(start:string,allDay:boolean,zone:string):Recurrence{
 const day=localDate(start,allDay,zone),date=new Date(day+'T12:00:00'),weekday=weekdayCodes[(date.getDay()+6)%7]
 return {frequency:'',interval:1,weekdays:[weekday],week_start:'MO',monthly_mode:'day',month_day:date.getDate(),year_month:date.getMonth()+1,weekday,ordinal:Math.ceil(date.getDate()/7),ending:'never',until:day,count:10}
}
export function parseRecurrence(rule:string,start:string,allDay:boolean,zone:string):Recurrence|null{
 const result=recurrenceDefaults(start,allDay,zone);if(!rule)return result
 const entries=rule.toUpperCase().split(';').map(p=>p.split('='));if(entries.some(p=>p.length!==2))return null
 const fields=Object.fromEntries(entries),allowed=['FREQ','INTERVAL','BYDAY','BYMONTHDAY','BYMONTH','BYSETPOS','UNTIL','COUNT','WKST']
 if(Object.keys(fields).length!==entries.length||Object.keys(fields).some(k=>!allowed.includes(k))||!['DAILY','WEEKLY','MONTHLY','YEARLY'].includes(fields.FREQ))return null
 result.frequency=fields.FREQ as Recurrence['frequency'];result.interval=Number(fields.INTERVAL||1)
 if(!Number.isInteger(result.interval)||result.interval<1||result.interval>99||fields.UNTIL&&fields.COUNT)return null
 if(fields.WKST){if(!weekdayCodes.includes(fields.WKST))return null;result.week_start=fields.WKST}
 if(result.frequency==='WEEKLY'){
  result.weekdays=fields.BYDAY?fields.BYDAY.split(','):result.weekdays
  if(!result.weekdays.length||result.weekdays.some(d=>!weekdayCodes.includes(d))||fields.BYMONTHDAY||fields.BYMONTH||fields.BYSETPOS)return null
 }else if(result.frequency==='MONTHLY'||result.frequency==='YEARLY'){
  if(result.frequency==='MONTHLY'&&fields.BYMONTH)return null
  if(result.frequency==='YEARLY'){
   if((fields.BYDAY||fields.BYMONTHDAY)&&!fields.BYMONTH)return null
   result.year_month=Number(fields.BYMONTH||result.year_month)
   if(!Number.isInteger(result.year_month)||result.year_month < 1||result.year_month > 12)return null
  }
  if(fields.BYDAY){
   const match=fields.BYDAY.match(/^(-?\d)?(MO|TU|WE|TH|FR|SA|SU)$/)
   if(!match||fields.BYMONTHDAY)return null
   const ordinal=Number(match[1]||fields.BYSETPOS||0);if(!Number.isInteger(ordinal)||ordinal===0||ordinal< -5||ordinal>5)return null
   if(match[1]&&fields.BYSETPOS)return null
   result.monthly_mode='weekday';result.weekday=match[2];result.ordinal=ordinal
  }else if(fields.BYSETPOS)return null
  else if(fields.BYMONTHDAY){result.month_day=Number(fields.BYMONTHDAY);if(!Number.isInteger(result.month_day)||result.month_day===0||result.month_day< -31||result.month_day>31)return null}
 }else if(fields.BYDAY||fields.BYMONTHDAY||fields.BYMONTH||fields.BYSETPOS)return null
 if(fields.COUNT){result.count=Number(fields.COUNT);if(!Number.isInteger(result.count)||result.count<1||result.count>9999)return null;result.ending='count'}
 if(fields.UNTIL){
  const match=fields.UNTIL.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z)?$/);if(!match)return null
  if(match[4]){const value=`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`;if(!Number.isFinite(+new Date(value)))return null;result.until=localDate(value,false,zone)}else result.until=`${match[1]}-${match[2]}-${match[3]}`
  result.ending='until'
 }
 return result
}
