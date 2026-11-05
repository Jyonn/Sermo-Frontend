function hundredths(value:string):bigint|null{
  if(value.length>18||!/^\d+(\.\d{1,2})?$/.test(value))return null;
  const [whole,fraction='']=value.split('.');
  return BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
}
export function fixedMoney(value:bigint){return `${value/100n}.${String(value%100n).padStart(2,'0')}`;}
export function normalizeMoney(value:string){const parsed=hundredths(value);return parsed===null?value:fixedMoney(parsed);}
/** FX input is CNY for 100 units; calculate preview cents without floating point. */
export function reimbursementCny(amount:string,currency:string,rate:string):string|null{
  const cents=hundredths(amount),quote=currency==='CNY'?10000n:hundredths(rate);
  if(cents===null||quote===null||cents<=0n||quote<=0n||cents>1000000000n||quote>10000000000n)return null;
  return fixedMoney((cents*quote+5000n)/10000n);
}
export function reimbursementTotal(items:Array<{amount:string;currency:string;exchange_rate:string}>){
  let sum=0n;
  for(const item of items){const converted=reimbursementCny(item.amount,item.currency,item.exchange_rate);if(converted===null)return null;sum+=hundredths(converted)!;}
  return sum>1000000000n?null:fixedMoney(sum);
}
