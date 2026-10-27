export type CalendarPolicy={detail:number[];busy:number[]};
export type CalendarSetup={status:string;groups:{id:number;name:string}[];policy:CalendarPolicy;members:{id:number;name:string}[]};
export type CalendarDisplays={displays:{member_id:number;id:string;url:string}[];renew_after:number};
export type ResearchMeeting={id:string;creator_id:number;status:string;invitation_id:string|null;title:string;description:string;location:string;start:string;end:string;timezone:string;all_day:boolean;members:number[];group_id:number};
