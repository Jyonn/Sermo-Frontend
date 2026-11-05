import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesResearchDiscussion,researchDiscussionDay,submittedReportRewards} from '../src/lib/researchDiscussion.ts';
import type {ResearchProject} from '../src/lib/research.ts';

test('member and day filters intersect, including the Shanghai date boundary',()=>{
 const entry={id:'reply',user_id:7,body:'Reply',created_at:'2026-11-04T17:00:00Z'};
 assert.equal(researchDiscussionDay(entry.created_at),'2026-11-05');
 assert.equal(matchesResearchDiscussion(entry,'2026-11-05',7),true);
 assert.equal(matchesResearchDiscussion(entry,'2026-11-04',7),false);
 assert.equal(matchesResearchDiscussion(entry,'2026-11-05',8),false);
 assert.equal(matchesResearchDiscussion(entry,'all',7),true);
 assert.equal(matchesResearchDiscussion(entry,'2026-11-05',null),true);
});
test('report toast excludes concurrent manual grants and earlier report awards',()=>{
 const previous={tasks:[{id:'task',progress:[{id:'old'}]}]} as ResearchProject;
 const next={tasks:[{id:'task',progress:[{id:'new',user_id:7,report_kind:'daily'},{id:'old'}]}],workflow:{ledger:[{id:'automatic',source_id:'new',origin:'report',user_id:7,amount:2},{id:'manual',source_id:'new',origin:'manual',user_id:7,amount:9},{id:'older',source_id:'old',origin:'report',user_id:7,amount:3}]}} as ResearchProject;
 assert.deepEqual(submittedReportRewards(previous,next,7,'task').awards.map(item=>item.id),['automatic']);
 next.workflow!.ledger=[];
 assert.deepEqual(submittedReportRewards(previous,next,7,'task').awards,[]);
});
