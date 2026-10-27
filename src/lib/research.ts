export type ResearchTask = {id:string;title:string;body:string;start:string;end:string|null;assignees:number[];status:'todo'|'doing'|'done';progress:Array<{id:string;user_id:number;body:string;created_at:string;reply_to?:string}>};
export type ResearchSummary={id:number;title:string;status:'planning'|'active'|'completed';start:string;end:string|null};
export type ResearchProject=ResearchSummary&{chat_id:number;description:string;revision:number;members:Array<{id:number;name:string;owner:boolean}>;tasks:ResearchTask[]};
