const themes = {
  gilded: {number:'01', en:'GILDED OCCASION', name:['鎏光礼序','Gilded occasion'], palette:['#853947','#c3a16a','#f4ead9'], description:['香槟金的仪式感，酒红色的温度。把一场郑重的生日礼遇，藏进每一次日常相遇。','Champagne, burgundy and quiet ceremony. An occasion worthy of you, woven into everyday conversations.'], heading:['今天的主角，\n是你。','Today belongs\nto you.'], line:['A day, all yours.','A day, all yours.'], wish:['愿新的一岁，所遇皆温柔。\n每一个平凡日子，都有值得举杯的瞬间。','May this new chapter meet you with kindness.\nMay ordinary days give you reasons to celebrate.'], gesture:['点亮今天的心愿','Make a birthday wish'], mark:'✧', motion:['一束礼花，落下即停','A single, gentle shower of golden confetti']},
  orbital: {number:'02', en:'A LETTER FROM THE STARS', name:['星河来信','A letter from the stars'], palette:['#101f32','#cdb587','#e9e0cc'], description:['深蓝的天文馆，环绕着你的星轨。让生日成为一次安静而盛大的宇宙来信。','An intimate observatory, an orbit of your own. A quiet, magnificent birthday letter from the universe.'], heading:['新的一岁，\n自有星光。','Another year.\nYour own light.'], line:['Another orbit, another you.','Another orbit, another you.'], wish:['你已完成又一次绕太阳的旅行。\n下一程，愿好奇不止，心中始终有光。','Another beautiful journey around the sun.\nStay curious. Carry your own light into the next.'], gesture:['向星河许个愿','Send a wish to the stars'], mark:'✦', motion:['星点短暂汇聚，缓缓熄落','A brief gathering of starlight, then stillness']},
  botanical: {number:'03', en:'A GARDEN OF TOMORROWS', name:['花间来日','A garden of tomorrows'], palette:['#58775c','#c39a87','#f2efdf'], description:['纸上的花园与手绘奶油。把祝福写成一封有纸张温度、能够慢慢读的信。','A painted garden, buttercream and warm paper. Birthday wishes as a letter you can take your time reading.'], heading:['愿你的每一天，\n都向着花开。','A new chapter,\nin full bloom.'], line:['Bloom into your next chapter.','Bloom into your next chapter.'], wish:['不用急着长大，也不用赶着抵达。\n愿你按照自己的季节，慢慢盛开。','There is no need to hurry, no finish line to chase.\nMay you bloom in your own beautiful season.'], gesture:['把心愿种在今天','Plant a birthday wish'], mark:'❋', motion:['花瓣轻落一次，留下安静的花园','One soft fall of petals, then a quiet garden']},
  pop: {number:'04', en:'A LITTLE MORE JOY', name:['糖纸派对','A little more joy'], palette:['#343fa7','#e76c51','#f9dc8e'], description:['钴蓝、珊瑚红与奶油黄。像拆开一份精心挑选的礼物，轻快、明亮，又不失质感。','Cobalt, coral and butter yellow. The delight of opening a thoughtful gift: playful, bright and beautifully made.'], heading:['今天的快乐，\n全部归你！','All this joy?\nIt’s yours!'], line:['Make room for joy.','Make room for joy.'], wish:['把烦恼留给昨天，把好心情装进口袋。\n新的一岁，继续做那个闪闪发光的你！','Leave yesterday’s worries behind. Pocket a little joy.\nKeep being your wonderful, unmistakable self.'], gesture:['拆开今天的惊喜','Unwrap a birthday wish'], mark:'✳', motion:['彩纸轻快散落一次，不循环','One playful confetti burst, never a loop']},
};
const dictionary = {
  zh: {lab:'生日设计室',edition:'四套主题 · 本地预览',intro:'让一个人的特别日，\n成为整个友间的温柔时刻。',skins:'全站皮肤',welcome:'全屏欢迎',compare:'四案对比',note:'每套主题包含全站配色、\n同系列欢迎页与轻量庆祝动效。',local:'本地设计预览 · 不修改线上皮肤',performance:'动效播放一次 · 无背景音乐 · 支持减少动态效果',dark:'切换明暗',reduce:'减少动态效果',language:'English',desktop:'桌面',phone:'手机',expand:'全屏体验',name:'称呼',chat:'聊天',square:'广场',contacts:'通讯',menu:'菜单',search:'搜索聊天',friends:'好友',mine:'我的',explore:'探索',activities:'活动',now:'刚刚',group:'小小庆祝委员会',members:'4 位成员 · 3 人在线',bdayNote:'今天的你，值得被认真庆祝',ribbon:'今天，友间也为你换上了新衣',open:'打开祝福',today:'今天 · 09:41',friend1:'林间',friend2:'小满',friend3:'知夏',msg1:'今天的第一份祝福，先送给你。生日快乐！',msg2:'蛋糕、鲜花和好心情，都准备好了。',msg3:'被你们记在心上，真好。',msg4:'新的一岁，也要一起分享好多好多日常。',placeholder:'把今天的好心情分享出去…',cardLabel:'FRIENDEN · 特别为你',cardTitle:'生日快乐，',cardOpen:'收下一份特别的祝福',send:'发送',myReply:'谢谢你们，今天特别开心！',close:'关闭欢迎',forYou:'的特别日',signature:'来自友间，和所有惦记你的人',enter:'直接进入友间',replay:'再次庆祝',wishTitle:'愿望已经收好。',wishText:'闭上眼睛，给自己一个小小的愿望。\n愿未来的日子，慢慢把它变成答案。',wishDone:'带着好心情，出发',back:'进入同系列皮肤',see:'体验这套方案',overview:'视觉与交互',post1:'今天，又多了一件值得庆祝的小事。',post2:'愿有人陪你热爱生活，\n也有人记得你的生日。',post3:'把祝福留在这里。愿每一个特别的日子，都有人一起度过。',likes:'喜欢',birthTheme:'生日限定外观',account:'账号与安全',notify:'通知',personalize:'语言与个性化',apps:'应用',updates:'检查更新',version:'已是最新版本',space:'Jyonn Space',online:'在线',controls:'在聊天、广场和菜单间切换，查看整套皮肤',sampleOnly:'示例内容，仅用于本地设计预览',inputName:'输入生日称呼',previewSent:'已添加到本地预览',actionHint:'此处展示皮肤样式，未连接真实账号'},
  en: {lab:'Birthday atelier',edition:'FOUR DIRECTIONS · LOCAL PREVIEW',intro:'A special day for one.\nA warmer space for everyone.',skins:'Site skin',welcome:'Welcome',compare:'Compare',note:'Each direction pairs a complete skin\nwith a matching welcome and light motion.',local:'Local design preview · Production settings are unchanged',performance:'One-shot motion · No audio · Reduced-motion support',dark:'Toggle color mode',reduce:'Reduce motion',language:'中文',desktop:'Desktop',phone:'Phone',expand:'Full screen',name:'For',chat:'Chats',square:'Square',contacts:'People',menu:'Menu',search:'Search chats',friends:'Friends',mine:'Mine',explore:'Explore',activities:'Activities',now:'Now',group:'The celebration committee',members:'4 members · 3 online',bdayNote:'A little more care, just for you',ribbon:'Frienden is dressed up for your special day',open:'Open your wishes',today:'TODAY · 09:41',friend1:'Lin',friend2:'Man',friend3:'Xia',msg1:'The first birthday wish of the day is yours. Happy birthday!',msg2:'Cake, flowers, and good company. All here.',msg3:'It feels lovely to be remembered.',msg4:'Here’s to another year of sharing our everyday lives.',placeholder:'Share a little birthday joy…',cardLabel:'FRIENDEN · JUST FOR YOU',cardTitle:'Happy birthday, ',cardOpen:'A little birthday something',send:'Send',myReply:'Thank you. You made my day!',close:'Close welcome',forYou:'’s special day',signature:'From Frienden, and everyone thinking of you',enter:'Go straight to Frienden',replay:'Celebrate again',wishTitle:'Your wish is safe with us.',wishText:'Close your eyes. Make a little wish.\nMay the days ahead gently turn it into reality.',wishDone:'Carry this joy with you',back:'Enter the matching skin',see:'Explore this direction',overview:'ART DIRECTION & INTERACTION',post1:'Another little reason to celebrate today.',post2:'May someone share your joy,\nand remember your birthday.',post3:'Leave a little wish here. May your special days always be shared.',likes:'Like',birthTheme:'Birthday edition',account:'Account & security',notify:'Notifications',personalize:'Language & personalization',apps:'Apps',updates:'Check for updates',version:'Up to date',space:'Jyonn Space',online:'Online',controls:'Switch between chats, Square and Menu to explore the complete skin',sampleOnly:'Illustrative content for local design preview',inputName:'Birthday recipient',previewSent:'Added to this local preview',actionHint:'A skin preview, not connected to a real account'},
};
const params = new URLSearchParams(location.search);
let theme = Object.hasOwn(themes, params.get('theme')) ? params.get('theme') : 'gilded';
let scene = ['skin','welcome','compare'].includes(params.get('scene')) ? params.get('scene') : 'skin';
let lang = params.get('lang') === 'en' ? 'en' : 'zh';
let device = params.get('device') === 'phone' || matchMedia('(max-width:540px)').matches ? 'phone' : 'desktop';
let dark = params.get('dark') === 'true';
let reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
let recipient = params.get('name')?.trim().slice(0,16) || '阿言';
let page = 'chat';
let wished = false;
let extraMessages = [];
let timers = [];
const root = document.getElementById('lab');
const t = key => dictionary[lang][key] ?? key;
const l = values => values[lang === 'zh' ? 0 : 1];
const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const icon = name => `<span class="icon" aria-hidden="true">${name}</span>`;
const name = () => lang === 'en' && recipient === '阿言' ? 'Yan' : recipient;
const avatar = (label, cls='pink') => `<span class="avatar ${cls}" aria-hidden="true">${esc(label.slice(0,1))}</span>`;
const art = key => `./assets/${key}.webp`;
function button(action, glyph, label, cls='tool', attributes='') {
  return `<button type="button" class="${cls}" data-action="${action}" aria-label="${esc(label)}" title="${esc(label)}" ${attributes}>${icon(glyph)}</button>`;
}
function themeNav(key, item) {
  return `<button type="button" class="theme-choice" data-theme-choice="${key}" aria-pressed="${key===theme}"><span class="choice-num">${item.number}</span><strong>${l(item.name)}</strong><small>${item.en}</small><span class="swatches">${item.palette.map(color=>`<i style="--swatch:${color}"></i>`).join('')}</span><span class="choice-arrow">${icon('arrow_outward')}</span></button>`;
}
function rail() {
  return `<nav class="rail" aria-label="Frienden"><span class="rail-logo">f.</span>${[['chat','chat_bubble',t('chat')],['square','explore',t('square')],['contacts','group',t('contacts')],['menu','menu',t('menu')]].map(([value,glyph,label])=>`<button type="button" data-page="${value}" ${page===value?'aria-current="page"':''} aria-label="${label}" ${value==='menu'?'class="rail-bottom"':''}>${icon(glyph)}<span class="label">${label}</span></button>`).join('')}${avatar(name(),'green')}</nav>`;
}
function chatList() {
  return `<aside class="chat-list"><header class="list-header"><h2>${t('chat')}</h2>${button('hint','edit_square',t('send'),'icon-button')}</header><div class="list-search">${icon('search')}${t('search')}</div><div class="birthday-note"><span>For you, today.</span><strong>${t('bdayNote')}</strong></div>${[[t('group'),t('msg2'),'gold',true],[t('friend1'),t('msg1'),'green'],[t('friend2'),t('msg4'),'pink'],[t('friend3'),t('post1'),'blue']].map(([title,summary,color,selected],i)=>`<button type="button" class="chat-row ${selected?'selected':''}" data-action="${selected?'chat':'hint'}">${avatar(title,color)}<span class="row-copy"><strong>${title}</strong><p>${summary}</p></span><span class="row-meta">${i===0?t('now'):'09:2'+i}</span></button>`).join('')}</aside>`;
}
function message(person, text, mine=false, color='pink') {
  return `<div class="message ${mine?'mine':''}">${avatar(person,color)}<div class="message-copy">${!mine?`<small>${esc(person)}</small>`:''}<div class="bubble">${esc(text)}</div></div></div>`;
}
function chat() {
  return `${chatList()}<section class="chat-main"><header class="conversation-header"><div><strong>${t('group')}</strong><small>${t('members')}</small></div><span class="header-actions">${button('hint','search',t('search'),'icon-button')}${button('hint','more_horiz',t('menu'),'icon-button')}</span></header><div class="birthday-ribbon"><span>${icon('cake')}${t('ribbon')}</span><button class="text-link" data-action="celebrate">${t('open')} ↗</button></div><div class="message-scroll"><p class="day-label">${t('today')}</p>${message(t('friend1'),t('msg1'),false,'green')}<div class="message">${avatar(t('friend2'))}<div class="message-copy"><small>${t('friend2')}</small><button type="button" class="birthday-card" data-action="celebrate"><img src="${art(theme)}" alt="${l(themes[theme].name)}" width="1024" height="1536"/><span class="card-copy"><small>${t('cardLabel')}</small><strong>${t('cardTitle')}${esc(name())}</strong><span class="card-bottom">${t('cardOpen')}${icon('arrow_outward')}</span></span></button></div></div>${message(name(),t('msg3'),true,'gold')}${message(t('friend3'),t('msg4'),false,'blue')}${extraMessages.map(text=>message(name(),text,true,'gold')).join('')}</div><form class="composer" id="compose"><div class="composer-icons">${['mood','image','mic','add_circle'].map(glyph=>button('hint',glyph,t('send'),'')).join('')}</div><div class="compose-line"><input autocomplete="off" id="message-input" maxlength="300" aria-label="${t('send')}" placeholder="${t('placeholder')}"/><button class="send" type="submit" aria-label="${t('send')}">${icon('arrow_upward')}</button></div></form></section>`;
}
function square() {
  return `<section class="page-main"><h2>${t('square')}</h2><p class="page-eyebrow">${t('bdayNote')}</p><nav class="square-tabs">${['activities','explore','friends','mine'].map(key=>`<span class="${key==='friends'?'active':''}">${t(key)}</span>`).join('')}</nav><div class="square-grid"><article class="post"><button data-action="celebrate" style="padding:0;width:100%;text-align:left"><img src="${art(theme)}" alt="${l(themes[theme].name)}"/><div class="post-copy">${t('post1')}<span class="author">${avatar(t('friend2'))}${t('friend2')}<span style="margin-left:auto">♡ 12</span></span></div></button></article><article class="post"><div class="text-post">${t('post2').replace('\n','<br/>')}</div><div class="post-copy">${t('post3')}<span class="author">${avatar(t('friend1'),'green')}${t('friend1')}<span style="margin-left:auto">♡ 8</span></span></div></article><article class="post"><div class="post-copy">${t('msg4')}<span class="author">${avatar(t('friend3'),'blue')}${t('friend3')}<span style="margin-left:auto">♡ 6</span></span></div></article></div></section>`;
}
function menu() {
  return `<section class="page-main"><h2>${t('menu')}</h2><div class="settings-profile">${avatar(name(),'gold')}<div><strong>${esc(name())}</strong><small>${t('space')} · ${t('birthTheme')}</small></div></div><button class="settings-cover" data-action="celebrate" style="width:100%;text-align:left"><span>A little celebration.</span><small>${t('open')} ↗</small></button><div class="settings-panel">${[['person','account'],['notifications','notify'],['palette','personalize'],['apps','apps'],['update','updates']].map(([glyph,key])=>`<button class="setting-row" data-action="hint" style="width:100%;text-align:left">${icon(glyph)}<strong>${t(key)}</strong>${key==='updates'?`<small>${t('version')}</small>`:''}<span class="end">${icon('chevron_right')}</span></button>`).join('')}</div></section>`;
}
function contacts() {
  return `<section class="page-main"><h2>${t('contacts')}</h2><p class="page-eyebrow">${t('space')}</p><div class="settings-panel">${[[t('friend1'),'green'],[t('friend2'),'pink'],[t('friend3'),'blue']].map(([person,color])=>`<button class="setting-row" style="width:100%;text-align:left" data-action="chat">${avatar(person,color)}<strong>${person}</strong><small>${t('online')}</small>${icon('chevron_right')}</button>`).join('')}</div></section>`;
}
function welcome() {
  const item=themes[theme];
  return `<section class="welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title"><div class="welcome-art"><img src="${art(theme)}" alt="${l(item.name)}" width="1024" height="1536" fetchpriority="high"/></div><div class="welcome-copy"><span class="welcome-brand">Frienden</span><span class="welcome-kicker">${esc(name())}${t('forYou')}</span><h2 id="welcome-title">${l(item.heading)}</h2><p class="birthday-en">${l(item.line)}</p><p class="welcome-message">${l(item.wish)}</p><span class="welcome-signature">${t('signature')}</span><button class="welcome-primary" data-action="wish">${wished?t('replay'):l(item.gesture)}${icon('arrow_outward')}</button><button class="welcome-secondary" data-action="enter">${t('enter')}${icon('arrow_forward')}</button><span class="welcome-edition">FRIENDEN · BIRTHDAY EDITION / ${item.number}</span></div>${button('enter','close',t('close'),'welcome-close')}</section>`;
}
function compare() {
  return `<div class="compare-grid">${Object.entries(themes).map(([key,item])=>`<article class="compare-card"><div class="compare-art"><img src="${art(key)}" alt="${l(item.name)}" loading="lazy"/><span>0${Number(item.number)} / FRIENDEN</span><button data-try="${key}">${t('see')} ↗</button></div><div class="compare-copy"><span class="overline">${item.en}</span><h2>${l(item.name)}</h2><div class="compare-palette">${item.palette.map(color=>`<i style="--swatch:${color}"></i>`).join('')}</div><p>${l(item.description)}</p><span class="overline" style="font-size:8px;letter-spacing:.6px">${l(item.motion)}</span></div></article>`).join('')}</div>`;
}
function render() {
  timers.forEach(clearTimeout);timers=[];
  document.documentElement.lang=lang==='zh'?'zh-CN':'en';
  const item=themes[theme];
  root.innerHTML=`<header class="lab-top"><div class="lab-brand"><span class="monogram">f</span>Frienden <small>BIRTHDAY ATELIER</small></div><nav class="scene-switch" aria-label="${t('overview')}">${[['skin','skins'],['welcome','welcome'],['compare','compare']].map(([value,key])=>`<button data-scene="${value}" aria-pressed="${scene===value}">${t(key)}</button>`).join('')}</nav><div class="lab-tools">${button('dark','dark_mode',t('dark'),'tool',`aria-pressed="${dark}"`)}${button('reduce','motion_photos_off',t('reduce'),'tool',`aria-pressed="${reduced}"`)}<button class="tool" data-action="language" aria-label="${t('language')}" title="${t('language')}">${lang==='zh'?'EN':'中'}</button></div></header><div class="lab-layout"><aside class="design-nav"><span class="overline">${t('edition')}</span><h1>${t('lab')}</h1><p>${t('intro').replace('\n','<br/>')}</p>${Object.entries(themes).map(([key,value])=>themeNav(key,value)).join('')}<div class="nav-note">${icon('auto_awesome')}${t('note').replace('\n','<br/>')}</div></aside><main class="lab-stage"><header class="stage-caption"><div><strong>${scene==='compare'?t('overview'):item.number+' / '+l(item.name)}</strong><small>${scene==='compare'?t('edition'):l(item.description)}</small></div><div class="viewport-controls">${button('desktop','desktop_windows',t('desktop'),'',`aria-pressed="${device==='desktop'}"`)}${button('phone','smartphone',t('phone'),'',`aria-pressed="${device==='phone'}"`)}${scene!=='compare'?button('expand','open_in_full',t('expand'),''):''}</div></header><div class="preview-wrap">${scene==='compare'?compare():`<div class="preview ${device==='phone'?'phone-preview':''} ${reduced?'reduced':''}" data-theme="${theme}" data-dark="${dark}"><div class="app-shell">${rail()}${page==='chat'?chat():page==='square'?square():page==='contacts'?contacts():menu()}</div>${scene==='welcome'?welcome():''}</div>`}</div><footer class="stage-foot"><span>${t('local')}</span><span>${scene==='skin'?t('controls'):t('performance')}</span></footer></main></div>`;
  const next=new URLSearchParams({theme,scene,device,lang,...(dark?{dark:'true'}:{})});
  history.replaceState(null,'',`${location.pathname}?${next}`);
  if(scene==='welcome') {
    const welcomeEl = root.querySelector('.welcome');
    welcomeEl.append(welcomeEl.querySelector('.welcome-brand'));
    root.querySelector('.welcome-primary')?.focus({preventScroll:true});
    if(!reduced) celebrate();
  }
}
function celebrate() {
  const welcomeEl=root.querySelector('.welcome');
  if(!welcomeEl||reduced)return;
  const layer=document.createElement('div');layer.className='flecks';layer.setAttribute('aria-hidden','true');
  layer.innerHTML=Array.from({length:22},(_,i)=>`<i class="fleck" style="--x:${(i*37)%100}%;--size:${3+i%4}px;--color:${themes[theme].palette[i%3]};--delay:${i*0.035}s;--rotate:${i%2?-180:240}deg;--drift:${i%2?35:-40}px"></i>`).join('');
  welcomeEl.append(layer);timers.push(setTimeout(()=>layer.remove(),3600));
}
function toast(text) {
  root.querySelector('.live-toast')?.remove();
  const el=document.createElement('div');el.className='live-toast';el.setAttribute('role','status');el.textContent=text;
  root.querySelector('.preview')?.append(el);timers.push(setTimeout(()=>el.remove(),2200));
}
root.addEventListener('click',async event=>{
  const target=event.target.closest('button');if(!target)return;
  if(target.dataset.themeChoice){theme=target.dataset.themeChoice;wished=false;extraMessages=[];render();return;}
  if(target.dataset.scene){scene=target.dataset.scene;render();return;}
  if(target.dataset.page){page=target.dataset.page;scene='skin';render();return;}
  if(target.dataset.try){theme=target.dataset.try;scene='welcome';wished=false;render();return;}
  const action=target.dataset.action;
  if(action==='dark'){dark=!dark;render();}
  else if(action==='reduce'){reduced=!reduced;render();}
  else if(action==='language'){lang=lang==='zh'?'en':'zh';render();}
  else if(action==='desktop'||action==='phone'){device=action;render();}
  else if(action==='celebrate'){scene='welcome';render();}
  else if(action==='enter'){scene='skin';page='chat';render();root.querySelector('[data-action="celebrate"]')?.focus({preventScroll:true});}
  else if(action==='chat'){page='chat';scene='skin';render();}
  else if(action==='expand'){const el=root.querySelector('.preview');try{if(document.fullscreenElement)await document.exitFullscreen();else await el?.requestFullscreen();}catch{toast(t('actionHint'));}}
  else if(action==='hint'){toast(t('actionHint'));}
  else if(action==='wish'){
    if(wished){wished=false;render();return;}
    const welcomeEl=root.querySelector('.welcome');welcomeEl.classList.add('wishing');
    const feedback=document.createElement('section');feedback.className='wish-feedback';feedback.setAttribute('role','status');
    feedback.innerHTML=`<span class="wish-glyph" aria-hidden="true">${themes[theme].mark}</span><h3>${t('wishTitle')}</h3><p>${t('wishText')}</p><button data-action="wish-done">${t('wishDone')} ↗</button>`;
    welcomeEl.append(feedback);feedback.querySelector('button').focus();
  }else if(action==='wish-done'){wished=true;scene='skin';page='chat';render();toast(t('wishTitle'));}
});
root.addEventListener('submit',event=>{
  if(event.target.id!=='compose')return;event.preventDefault();
  const input=root.querySelector('#message-input');const text=input.value.trim();if(!text)return;
  extraMessages.push(text);render();
  const scroll=root.querySelector('.message-scroll');scroll.scrollTop=scroll.scrollHeight;
  root.querySelector('#message-input')?.focus();
});
document.addEventListener('keydown',event=>{
  if(scene!=='welcome')return;
  if(event.key==='Escape'){scene='skin';render();return;}
  if(event.key==='Tab'){
    const dialog=root.querySelector('.wish-feedback')??root.querySelector('.welcome');
    const controls=[...dialog.querySelectorAll('button')];const first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible')root.querySelector('.flecks')?.remove();});
render();
