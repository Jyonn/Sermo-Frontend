import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { consentPermissionGroups, updateOAuthScopes, type OAuthScopeCatalogEntry } from '../src/lib/oauthScopes.ts';

test('only server-available scopes can be added; read, write and modify are independent',()=>{
  const catalog: OAuthScopeCatalogEntry[] = [
    {scope:'chat.read',domain:'chat',action:'read',status:'implemented',available:true},
    {scope:'chat.write',domain:'chat',action:'write',status:'implemented',available:true},
    {scope:'chat.modify',domain:'chat',action:'modify',status:'implemented',available:false},
  ];
  assert.deepEqual(updateOAuthScopes(['profile'],'chat.write',true,catalog),['profile','chat.write']);
  assert.deepEqual(updateOAuthScopes(['profile'],'chat.modify',true,catalog),['profile']);
  assert.deepEqual(updateOAuthScopes(['profile'],'square.write',true,catalog),['profile']);
  assert.deepEqual(updateOAuthScopes(['chat.read','chat.write'],'chat.read',false,catalog),['chat.write']);
  assert.deepEqual(updateOAuthScopes([],'chat.write',true),[]);
});

test('consent requires complete, unique, correctly grouped server permission metadata',()=>{
  const groups = [{key:'chat' as const,scopes:['chat.read','chat.write']}];
  assert.deepEqual(consentPermissionGroups(['chat.read','chat.write'],groups),groups);
  assert.equal(consentPermissionGroups(['chat.read','chat.write']),null);
  assert.equal(consentPermissionGroups(['chat.read','chat.write'],[{key:'chat',scopes:['chat.read']}]),null);
  assert.equal(consentPermissionGroups(['chat.read'],[{key:'chat',scopes:['chat.read','chat.read']}]),null);
  assert.equal(consentPermissionGroups(['chat.read'],[{key:'personal',scopes:['chat.read']}]),null);
  assert.equal(consentPermissionGroups(['square.modify'],[{key:'square',scopes:['square.modify']}]),null);
  assert.equal(consentPermissionGroups(['chat.send']),null);
  assert.deepEqual(consentPermissionGroups(['profile','email']),[{key:'personal',scopes:['profile','email']}]);
});

test('all thirteen implemented permissions have Chinese and English consent descriptions',()=>{
  const groups = [
    {key:'chat' as const,scopes:['chat.read','chat.write','chat.modify']},
    {key:'square' as const,scopes:['square.read','square.write']},
    {key:'submission' as const,scopes:['submission.read','submission.write','submission.modify']},
    {key:'contacts' as const,scopes:['contacts.read','contacts.write','contacts.modify']},
    {key:'personal' as const,scopes:['personal.read','personal.modify']},
  ];
  const scopes=groups.flatMap(group=>group.scopes);
  assert.deepEqual(consentPermissionGroups(scopes,groups),groups);
  for(const locale of ['en','zh-CN']){
    const copy=JSON.parse(fs.readFileSync(new URL(`../src/locales/${locale}/translation.json`,import.meta.url),'utf8'));
    for(const scope of scopes)assert.ok(copy[`apps.scope.${scope}`],`${locale}: ${scope}`);
    for(const group of groups)assert.ok(copy[`oauth.permissionGroup.${group.key}`]);
  }
});
