import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require=createRequire(import.meta.url);
const { StaticRouter }=require("react-router-dom/server");
const copy=JSON.parse(fs.readFileSync(new URL('../src/locales/zh-CN/translation.json',import.meta.url),'utf8'));
const search='?request_id='+'a'.repeat(43);
const admin={key:'jyonn:2',slug:'jyonn',spaceName:'Jyonn Space',session:{user:{user_id:2,space_id:2,name:'空间管理员'},accessToken:'fixture'}};
const member={key:'wzry:1',slug:'wzry',spaceName:'其他空间',session:{user:{user_id:1,space_id:1,name:'非管理员测试账号'},accessToken:'fixture'}};
const client={id:'fixture',name:'板凳 · Abandon',description:'不应重复展示的长说明',callback:'https://example.test/callback',scopes:['profile','email'],purpose:'space_admin',target_space:null,parameters:{response_type:'code',redirect_uri:'https://example.test/callback',scope:'profile email',state:'s'.repeat(32),code_challenge:'a'.repeat(43),code_challenge_method:'S256'}};

function render(scene:'chooser'|'selected'|'member'|'general'|'empty'|'login-pending') {
  const session=scene==='selected'||scene==='login-pending'?admin.session:scene==='member'?member.session:null;
  const effectiveClient=['general','empty','login-pending'].includes(scene)?{...client,purpose:'join'}:client;
  const states=[false,'',session?{userId:session.user.user_id,value:{eligible:true,missing_verifications:[],space_admin:scene==='selected'}}:null,false,0,'Jyonn Space',scene==='empty'?[]:[member,admin],false,'','',new Set(scene==='member'?[]:[admin.key]),false,false,{search,client:effectiveClient}];
  let index=0;
  const exports:Record<string,any>={};
  const mockReact={...React,useState:()=>[states[index++],()=>{}],useEffect:()=>{},useRef:()=>({current:false})};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/pages/OAuthAuthorizePage.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
    exports,URLSearchParams,require:(name:string)=>{
      if(name==='react')return mockReact;
      if(name==='react-router-dom')return {...require(name),useLocation:()=>({search})};
      if(name==='../lib/auth')return {useAuth:()=>({ready:true,session,setSession:()=>{}})};
      if(name==='../lib/language')return {useI18n:()=>({t:(key:string)=>copy[key]||key})};
      if(name==='../lib/pwaAccounts')return {listPwaCachedAccounts:()=>[member,admin]};
      if(name==='../lib/stillfolioLogin')return {parseSermoLoginHint:()=>null};
      if(name==='../lib/oauthPending')return {isOAuthLoginPending:()=>scene==='login-pending'};
      if(name==='../lib/spaceEntry')return {getDetectedSpaceSlug:()=>'',buildSpaceHrefForCurrentHost:()=>'/'};
      if(name==='../components/UserAvatar')return {UserAvatar:(props:any)=>React.createElement('span',{className:props.className,'aria-hidden':true},'友')};
      if(name==='../components/OAuthConsentBrand')return {OAuthConsentBrand:()=>React.createElement('div',{className:'oauth-brand-pair'},React.createElement('span',{className:'oauth-brand-icon'},'友'),React.createElement('span',{},'→'),React.createElement('span',{className:'oauth-brand-icon'},'板'))};
      if(name==='../components/OAuthVerificationCard')return {OAuthVerificationCard:()=>null};
      if(name.endsWith('.css'))return {};
      if(name.startsWith('../lib/'))return {};
      return require(name);
    },
  });
  return renderToStaticMarkup(React.createElement(StaticRouter,{location:'/oauth/authorize'+search},React.createElement(exports.default)));
}

test('admin chooser excludes unverified/member identities and styles entry actions',()=>{
  const html=render('chooser');
  assert.match(html,/空间管理员/);
  assert.doesNotMatch(html,/非管理员测试账号|其他空间|不应重复展示/);
  assert.match(html,/class="oauth-secondary"/);
  assert.match(html,/class="oauth-quiet"/);
});
test('selected administrator shows one identity and no alternate-space cards',()=>{
  const html=render('selected');
  assert.match(html,/Jyonn Space/);
  assert.match(html,/oauth-switch-account/);
  assert.doesNotMatch(html,/非管理员测试账号|其他空间|oauth-account-list|不应重复展示/);
});
test('current non-admin identity is not presented as consent identity',()=>{
  const html=render('member');
  assert.doesNotMatch(html,/非管理员测试账号|oauth-consent-identity|oauth-primary/);
  assert.match(html,/暂无可用/);
});

test('general chooser copy omits the app name and empty state does not repeat it',()=>{
  const html=render('general');
  assert.match(html,/<p>选择用于授权的空间账号<\/p>/);
  assert.doesNotMatch(html,/选择用于授权板凳/);
  const empty=render('empty');
  assert.match(empty,/暂无可用的空间账号/);
  assert.doesNotMatch(empty,/<p>选择用于授权的空间账号<\/p>/);
});

test('explicit login intent keeps an existing session on the chooser with a real login destination',()=>{
  const html=render('login-pending');
  assert.doesNotMatch(html,/oauth-selected-account|oauth-primary/);
  assert.match(html,/href="\/pwa\?oauth_login=1"/);
});

if(process.env.OAUTH_REVIEW_DIR){
  fs.mkdirSync(process.env.OAUTH_REVIEW_DIR,{recursive:true});
  const css=fs.readFileSync(new URL('../src/pages/MoreApps.css',import.meta.url),'utf8');
  for(const scene of ['chooser','selected','member'] as const)for(const dark of [false,true]){
    const vars=dark?'--bg-elevated:#1b2721;--bg-surface:#151e19;--line-soft:#2b3b32;--text-primary:#eff5f1;--text-secondary:#b9c8c0;--text-muted:#82998d;':'--bg-elevated:#f0f5f2;--bg-surface:#fff;--line-soft:#dae5de;--text-primary:#182c21;--text-secondary:#54665b;--text-muted:#6d8074;';
    fs.writeFileSync(process.env.OAUTH_REVIEW_DIR+'/'+scene+(dark?'-dark':'')+'.html',`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;font-family:system-ui}:root{${vars}--brand-primary:#20bf8b}button,a{-webkit-tap-highlight-color:transparent}.oauth-account-avatar{display:grid;place-items:center;background:#a7c5b5}${css}</style>${render(scene)}`);
  }
}
