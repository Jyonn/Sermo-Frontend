const words={
  zh:{components:'主题组件',heading:'让细节，也过生日。',intro:'从日常卡片到二级弹层，祝福藏在边缘，信息留在中央。',modal:'确认弹窗',modalDesc:'CSS 自适应边线 · 独立透明角饰',modalTitle:'收下今天的祝福？',modalText:'一份小小的仪式感，送给今天的你。',confirm:'收下祝福',cancel:'稍后再说',drawer:'详情 Drawer',drawerDesc:'桌面侧边 · 手机底部 · 层级可体验',details:'会话详情',memberCount:'4 位成员',settings:'会话设置',remind:'消息提醒',theme:'空间皮肤',birthdayTheme:'生日限定',openDetails:'打开详情',sheet:'底部操作菜单',sheetDesc:'边缘饰件 · 动作图标保持清晰',sheetTitle:'和朋友一起庆祝',share:'分享祝福卡',save:'收藏这份祝福',copy:'复制祝福链接',remove:'删除示例',picker:'二级选择器',pickerDesc:'可从详情页继续打开，不遮错层',visibility:'谁可以看到',all:'空间成员',friends:'仅好友',self:'仅自己',empty:'空状态与加载',emptyDesc:'同系列礼物插画 · 稀疏轻动效',emptyTitle:'第一份祝福，留给你来写',emptyText:'让一句心意，成为今天的开场。',write:'写一份祝福',loading:'正在收集好心情',notices:'轻提示与操作反馈',noticesDesc:'小饰件点缀 · 不干扰内容',noticeText:'祝福已经送达，好心情已签收。',showToast:'查看轻提示',saved:'已收下，生日快乐',card:'祝福卡片',cardDesc:'同系列饰件贯穿聊天和广场',cardTitle:'今天，值得被好好庆祝。',cardText:'留一份特别的祝福给特别的你。',openWelcome:'打开全屏欢迎',principle:'让功能清晰，让装饰有分寸',principleText:'正文、输入和按钮保持可读；装饰不拦截点击，危险操作不使用庆祝效果。',close:'关闭',back:'返回上一级',selected:'已选择',decor:'装饰',previewOnly:'本地示例，不会影响真实数据',dangerTitle:'删除这条示例？',dangerText:'此操作只关闭本地预览中的示例，不会删除任何真实消息。',dangerConfirm:'确认删除',genericToast:'已完成本地示例操作'},
  en:{components:'Components',heading:'A birthday in the details.',intro:'From everyday cards to layered dialogs: celebration at the edges, clarity at the center.',modal:'Confirmation',modalDesc:'Responsive CSS lines · Independent corner art',modalTitle:'A little birthday wish for you?',modalText:'A small moment of ceremony, just for you today.',confirm:'Receive this wish',cancel:'Maybe later',drawer:'Details drawer',drawerDesc:'Desktop side panel · Mobile sheet · Layered navigation',details:'Conversation details',memberCount:'4 members',settings:'Conversation settings',remind:'Message alerts',theme:'Space theme',birthdayTheme:'Birthday edition',openDetails:'Open details',sheet:'Action sheet',sheetDesc:'Corner ornaments · Clear functional icons',sheetTitle:'Celebrate with friends',share:'Share birthday card',save:'Save this wish',copy:'Copy card link',remove:'Delete example',picker:'Nested picker',pickerDesc:'Opens above details with correct return behavior',visibility:'Who can see this',all:'Space members',friends:'Friends only',self:'Only me',empty:'Empty & loading states',emptyDesc:'Coordinated gift artwork · Gentle, finite motion',emptyTitle:'Leave the very first birthday wish',emptyText:'A kind thought is a lovely way to start the day.',write:'Write a wish',loading:'Gathering a little joy',notices:'Toasts & feedback',noticesDesc:'Small art accents · Quiet reassurance',noticeText:'Your wish has arrived. A little joy, delivered.',showToast:'Preview toast',saved:'Received, with birthday joy',card:'Birthday card',cardDesc:'Matching art across chats and Square',cardTitle:'Today deserves to be celebrated.',cardText:'A special wish for someone special.',openWelcome:'Open birthday welcome',principle:'Clarity first. A little ceremony around it.',principleText:'Readable text, fields and actions. Decorations never catch clicks; destructive actions keep a neutral tone.',close:'Close',back:'Back one level',selected:'Selected',decor:'Decor',previewOnly:'Local preview; no real data changes',dangerTitle:'Delete this example?',dangerText:'This only dismisses a local preview example. No real message or data will be deleted.',dangerConfirm:'Delete example',genericToast:'Local preview action complete'}
};
let context;
let layers=[];
let decorated=true;
let visibility='all';
let reminders=true;
let toastTimer;
let selectedDay=6;
let resizeObserver;
Object.assign(words.zh,{calendar:'日期选择',calendarDesc:'全局月历 · 小角饰 · 选中态清晰',month:'2026 年 11 月',form:'表单与输入',formDesc:'装饰避让输入区 · 统一尺寸',wishLabel:'写下生日心愿',wishPlaceholder:'希望新的一岁…',saveWish:'保存心愿',dayPicked:'已选择 11 月',daySuffix:'日'});
Object.assign(words.en,{calendar:'Calendar',calendarDesc:'Shared calendar · Quiet art · Clear selection',month:'November 2026',form:'Forms & inputs',formDesc:'Unobstructed fields · Consistent sizing',wishLabel:'A birthday wish',wishPlaceholder:'In this new chapter…',saveWish:'Save this wish',dayPicked:'Selected November',daySuffix:''});
Object.assign(words.zh,{resize:'尺寸适配',resizeDesc:'拖动右下角，边线自动跟随，角饰保持比例',resizeHint:'宽度和高度都可以改变',wideModal:'宽弹窗',tallModal:'长内容弹窗'});
Object.assign(words.en,{resize:'Responsive borders',resizeDesc:'Drag the lower-right handle. Lines follow; corner art keeps its proportions.',resizeHint:'Both width and height can change',wideModal:'Wide dialog',tallModal:'Tall dialog'});
const w=key=>words[context?.().lang??'zh'][key];
const symbol=name=>`<span class="icon" aria-hidden="true">${name}</span>`;
export const componentLabel=lang=>words[lang].components;
export function themeEmblem(theme, className='',size=''){
  return `<img class="theme-emblem ${className}" src="./assets/${theme}-ornament-v1.webp" alt="" aria-hidden="true" width="1312" height="1199" ${size?`style="width:${size}px"`:''}/>`;
}
const primary=(label,action)=>`<button class="ui-primary" data-ui="${action}" type="button">${label}${symbol('arrow_outward')}</button>`;
const secondary=(label,action)=>`<button class="ui-secondary" data-ui="${action}" type="button">${label}</button>`;
const closeButton=()=>`<button class="ui-close" data-ui="close" aria-label="${w('close')}" type="button">${symbol('close')}</button>`;
const sampleLabel=(title,description)=>`<div class="component-label"><strong>${w(title)}</strong><span>${w(description)}</span></div>`;
function rows(){return [['share','ios_share'],['save','bookmark'],['copy','link']].map(([key,glyph])=>`<button class="sample-sheet-row" data-ui="${key==='share'?'modal':'toast'}" type="button">${symbol(glyph)}<span>${w(key)}</span>${symbol('chevron_right')}</button>`).join('');}
function calendar(){
  const weekdays=context().lang==='zh'?['一','二','三','四','五','六','日']:['M','T','W','T','F','S','S'];
  return `<div class="mini-calendar"><header><strong>${w('month')}</strong><button type="button" data-ui="calendar" aria-label="${w('calendar')}">${symbol('calendar_month')}</button></header><div class="calendar-days">${weekdays.map(day=>`<span>${day}</span>`).join('')}${Array.from({length:6},()=>'<i></i>').join('')}${Array.from({length:30},(_,index)=>`<button data-ui="pick-date" data-day="${index+1}" aria-pressed="${index+1===selectedDay}" type="button">${index+1}</button>`).join('')}</div></div>`;
}
export function componentGallery(theme,lang){
  const text=key=>words[lang][key];
  return `<section class="component-page"><header class="component-header"><div><span class="overline">FRIENDEN / THEMED COMPONENTS</span><h2>${text('heading')}</h2><p>${text('intro')}</p></div>${themeEmblem(theme)}</header><div class="component-groups">
  <section class="component-group">${sampleLabel('modal','modalDesc')}<div class="component-sample sample-modal ornate-frame"><h3>${text('modalTitle')}</h3><p>${text('modalText')}</p><div class="sample-actions">${secondary(text('cancel'),'modal')}${primary(text('confirm'),'modal')}</div></div></section>
  <section class="component-group">${sampleLabel('drawer','drawerDesc')}<div class="component-sample sample-drawer"><header class="sample-drawer-header"><h3>${text('details')}</h3>${themeEmblem(theme)}</header><div class="sample-drawer-body"><div class="sample-member-line"><span class="avatar green">林</span><span class="avatar pink">满</span><span class="avatar blue">夏</span><span>${text('memberCount')}</span></div><button class="sample-choice" data-ui="picker"><span>${text('visibility')}</span><small>${text(visibility)}</small>${symbol('chevron_right')}</button>${secondary(text('openDetails'),'drawer')}</div></div></section>
  <section class="component-group">${sampleLabel('sheet','sheetDesc')}<div class="component-sample sample-sheet ornate-frame">${rows()}<button class="sample-sheet-row" data-ui="sheet">${symbol('more_horiz')}<span>${text('sheet')}</span>${symbol('arrow_outward')}</button></div></section>
  <section class="component-group">${sampleLabel('picker','pickerDesc')}<div class="component-sample"><h3>${text('visibility')}</h3>${['all','friends','self'].map(key=>`<button class="sample-choice ${visibility===key?'selected':''}" data-ui="picker" data-visibility-choice="${key}"><span>${text(key)}</span>${symbol(visibility===key?'check':'chevron_right')}</button>`).join('')}<p>${text('previewOnly')}</p></div></section>
  <section class="component-group">${sampleLabel('empty','emptyDesc')}<div class="component-sample sample-empty">${themeEmblem(theme)}<h3>${text('emptyTitle')}</h3><p>${text('emptyText')}</p>${secondary(text('write'),'modal')}<div class="sample-loading" role="status">${themeEmblem(theme)}${text('loading')}<span class="loading-dots" aria-hidden="true"><i></i><i></i><i></i></span></div></div></section>
  <section class="component-group">${sampleLabel('notices','noticesDesc')}<div class="component-sample"><div class="sample-notice">${themeEmblem(theme)}<span>${text('noticeText')}</span></div>${secondary(text('showToast'),'toast')}<p>${text('previewOnly')}</p></div></section>
  <section class="component-group">${sampleLabel('calendar','calendarDesc')}<div class="component-sample sample-calendar ornate-frame">${calendar()}</div></section>
  <section class="component-group">${sampleLabel('form','formDesc')}<div class="component-sample sample-form">${themeEmblem(theme)}<label>${text('wishLabel')}<textarea rows="3" maxlength="160" placeholder="${text('wishPlaceholder')}"></textarea></label><button class="sample-choice" data-ui="calendar"><span>${text('calendar')}</span><small>${text('month')}</small>${symbol('chevron_right')}</button><button class="sample-choice" data-ui="picker"><span>${text('visibility')}</span><small data-visibility-label>${text(visibility)}</small>${symbol('chevron_right')}</button>${primary(text('saveWish'),'modal')}</div></section>
  <section class="component-group" style="grid-column:1/-1">${sampleLabel('resize','resizeDesc')}<div class="component-sample resize-sample ornate-frame"><div><strong>${text('resizeHint')}</strong><small data-live-size></small><div class="sample-actions">${secondary(text('wideModal'),'modal-wide')}${secondary(text('tallModal'),'modal-tall')}</div></div></div></section>
  <section class="component-group" style="grid-column:1/-1">${sampleLabel('card','cardDesc')}<button class="component-sample component-link-card" data-action="celebrate" type="button">${themeEmblem(theme)}<span><strong>${text('cardTitle')}</strong><small>${text('cardText')}</small></span>${symbol('arrow_outward')}</button></section>
  </div><aside class="component-banner">${themeEmblem(theme)}<p><strong>${text('principle')}</strong>${text('principleText')}</p></aside></section>`;
}
export function resetBirthdayLayers(){
  layers=[];
  clearTimeout(toastTimer);
  resizeObserver?.disconnect();
}
function attachCorners(container){
  container.querySelectorAll('.ornate-frame').forEach(surface=>{
    if(surface.querySelector(':scope>.theme-corner'))return;
    surface.insertAdjacentHTML('beforeend','<i class="theme-corner top-left" aria-hidden="true"></i><i class="theme-corner bottom-right" aria-hidden="true"></i>');
  });
}
export function decorateBirthdayPreview(preview,theme,lang){
  if(!preview)return;
  preview.classList.toggle('decor-off',!decorated);
  for(const selector of ['.conversation-header','.birthday-note','.settings-cover']){
    preview.querySelectorAll(selector).forEach(el=>el.insertAdjacentHTML('beforeend',themeEmblem(theme)));
  }
  preview.querySelectorAll('.birthday-card,.settings-cover,.welcome').forEach(el=>el.classList.add('ornate-frame'));
  attachCorners(preview);
  const resizer=preview.querySelector('.resize-sample');
  if(resizer&&typeof ResizeObserver!=='undefined'){
    resizeObserver=new ResizeObserver(entries=>{
      const {width,height}=entries[0].contentRect;
      resizer.querySelector('[data-live-size]').textContent=`${Math.round(width)} × ${Math.round(height)}`;
    });resizeObserver.observe(resizer);
  }
  const ribbonIcon=preview.querySelector('.birthday-ribbon>span>.icon');
  ribbonIcon?.insertAdjacentHTML('afterend',themeEmblem(theme));ribbonIcon?.remove();
  const more=preview.querySelector('.header-actions [data-action="hint"]:last-child');
  if(more){more.removeAttribute('data-action');more.dataset.ui='drawer';}
  preview.querySelectorAll('.settings-panel .setting-row').forEach(el=>{el.removeAttribute('data-action');el.dataset.ui='drawer';});
  const add=[...preview.querySelectorAll('.composer-icons button')].find(el=>el.textContent==='add_circle');
  if(add){add.removeAttribute('data-action');add.dataset.ui='sheet';}
  const bar=document.querySelector('.viewport-controls');
  if(bar){const button=document.createElement('button');button.className='theme-decoration-control';button.dataset.ui='decor';button.setAttribute('aria-pressed',String(decorated));button.innerHTML=`${symbol('auto_awesome')}${words[lang].decor}`;bar.append(button);}
}
function surface(kind){
  const {theme}=context();
  const ornament=themeEmblem(theme);
  const header=(title,description='')=>`<header class="ui-surface-header"><h2 id="ui-title-${layers.length}">${w(title)}</h2>${description?`<p>${w(description)}</p>`:''}</header>${closeButton()}`;
  if(kind==='drawer')return `<section class="ui-surface ui-drawer ornate-frame" role="dialog" aria-modal="true" aria-labelledby="ui-title-${layers.length}" tabindex="-1"><header class="ui-surface-header"><h2 id="ui-title-${layers.length}">${w('details')}</h2>${ornament}</header>${closeButton()}<div class="ui-surface-body"><div class="sample-member-line"><span class="avatar green">林</span><span class="avatar pink">满</span><span class="avatar blue">夏</span><span>${w('memberCount')}</span></div><button class="ui-setting-row" data-ui="toggle"><span>${w('remind')}</span><span class="ui-toggle" role="switch" aria-checked="${reminders}" aria-label="${w('remind')}"></span></button><button class="ui-setting-row" data-ui="picker"><span>${w('visibility')}</span><span class="row-end"><small data-visibility-label>${w(visibility)}</small>${symbol('chevron_right')}</span></button><button class="ui-setting-row" data-ui="modal"><span>${w('theme')}</span><span class="row-end"><small>${w('birthdayTheme')}</small>${symbol('chevron_right')}</span></button><p style="margin-top:25px">${w('previewOnly')}</p></div><footer class="ui-surface-footer">${secondary(w('back'),'close')}</footer></section>`;
  if(kind==='sheet')return `<section class="ui-surface ui-sheet ornate-frame" role="dialog" aria-modal="true" aria-labelledby="ui-title-${layers.length}" tabindex="-1">${header('sheetTitle')}<div class="ui-surface-body">${rows()}<button class="sample-sheet-row is-danger" data-ui="danger">${symbol('delete')}<span>${w('remove')}</span></button></div><footer class="ui-surface-footer">${secondary(w('cancel'),'close')}</footer></section>`;
  if(kind==='picker')return `<section class="ui-surface ui-picker ornate-frame" role="dialog" aria-modal="true" aria-labelledby="ui-title-${layers.length}" tabindex="-1">${header('visibility')}<div class="ui-surface-body">${['all','friends','self'].map(key=>`<button class="ui-setting-row ${visibility===key?'ui-picked':''}" data-ui="select" data-value="${key}"><span>${w(key)}</span>${symbol(visibility===key?'check':'radio_button_unchecked')}</button>`).join('')}</div><footer class="ui-surface-footer">${secondary(w('back'),'close')}</footer></section>`;
  if(kind==='calendar')return `<section class="ui-surface ui-picker ornate-frame" role="dialog" aria-modal="true" aria-labelledby="ui-title-${layers.length}" tabindex="-1">${header('calendar')}<div class="ui-surface-body">${calendar()}</div><footer class="ui-surface-footer">${secondary(w('back'),'close')}</footer></section>`;
  const danger=kind==='danger';
  return `<section class="ui-surface ui-modal ${danger?'':'ornate-frame'}" role="${danger?'alertdialog':'dialog'}" aria-modal="true" aria-labelledby="ui-title-${layers.length}" tabindex="-1">${header(danger?'dangerTitle':'modalTitle')}<div class="ui-surface-body"><p>${w(danger?'dangerText':'modalText')}</p>${danger?'':`<button class="ui-setting-row" data-ui="picker"><span>${w('visibility')}</span><span class="row-end"><small data-visibility-label>${w(visibility)}</small>${symbol('chevron_right')}</span></button>`}</div><footer class="ui-surface-footer">${secondary(w('cancel'),'close')}${danger?`<button class="ui-secondary" data-ui="finish-danger" style="color:#b46666">${w('dangerConfirm')}</button>`:primary(w('confirm'),'finish')}</footer></section>`;
}
function openLayer(kind){
  const preview=document.querySelector('.preview');if(!preview)return;
  const previous=layers.at(-1);if(previous){previous.element.inert=true;previous.element.setAttribute('aria-hidden','true');}
  else [...preview.children].filter(el=>!el.classList.contains('ui-toast')).forEach(el=>{el.inert=true;});
  const opener=document.activeElement;
  const element=document.createElement('div');element.className=`ui-layer ${kind==='drawer'?'ui-drawer-layer':kind==='sheet'?'ui-sheet-layer':''}`;element.style.zIndex=String(25+layers.length*2);
  element.innerHTML=surface(kind);attachCorners(element);preview.append(element);layers.push({element,opener});
  if(kind==='modal-wide')element.querySelector('.ui-surface').classList.add('ui-modal-wide');
  if(kind==='modal-tall'){
    const surfaceEl=element.querySelector('.ui-surface');surfaceEl.classList.add('ui-modal-tall');
    const text=document.createElement('p');text.className='ui-long-copy';text.textContent=w('intro')+' '+w('principleText');surfaceEl.querySelector('.ui-surface-body').append(text);
  }
  element.querySelector('.ui-surface').focus({preventScroll:true});
}
function closeLayer(){
  const current=layers.pop();if(!current)return;current.element.remove();
  const previous=layers.at(-1);
  if(previous){previous.element.inert=false;previous.element.removeAttribute('aria-hidden');}
  else document.querySelectorAll('.preview>[inert]').forEach(el=>{el.inert=false;});
  if(current.opener?.isConnected)current.opener.focus({preventScroll:true});
  else previous?.element.querySelector('.ui-surface').focus({preventScroll:true});
}
function showToast(message=w('saved'), festive=true){
  const {theme}=context();document.querySelector('.ui-toast')?.remove();clearTimeout(toastTimer);
  const el=document.createElement('div');el.className='ui-toast';el.setAttribute('role','status');el.innerHTML=`${festive?themeEmblem(theme):symbol('check')}<span></span>`;el.querySelector('span:last-child').textContent=message;
  document.querySelector('.preview')?.append(el);toastTimer=setTimeout(()=>el.remove(),2600);
}
export function installBirthdayComponents(root,getContext){
  context=getContext;
  root.addEventListener('click',event=>{
    if(event.target.classList.contains('ui-layer')&&event.target===layers.at(-1)?.element){closeLayer();return;}
    const button=event.target.closest('[data-ui]');if(!button)return;
    const action=button.dataset.ui;
    if(['modal','modal-wide','modal-tall','drawer','sheet','picker','danger','calendar'].includes(action)){openLayer(action);return;}
    if(action==='close'){closeLayer();return;}
    if(action==='toast'){showToast();return;}
    if(action==='finish'){closeLayer();showToast();return;}
    if(action==='finish-danger'){closeLayer();showToast(w('genericToast'),false);return;}
    if(action==='pick-date'){
      selectedDay=Number(button.dataset.day);
      root.querySelectorAll('[data-ui="pick-date"]').forEach(el=>el.setAttribute('aria-pressed',String(Number(el.dataset.day)===selectedDay)));
      showToast(`${w('dayPicked')} ${selectedDay}${w('daySuffix')}`,false);return;
    }
    if(action==='decor'){
      decorated=!decorated;document.querySelector('.preview')?.classList.toggle('decor-off',!decorated);button.setAttribute('aria-pressed',String(decorated));return;
    }
    if(action==='toggle'){
      reminders=!reminders;button.querySelector('[role=switch]').setAttribute('aria-checked',String(reminders));return;
    }
    if(action==='select'){
      visibility=button.dataset.value;closeLayer();
      root.querySelectorAll('[data-visibility-label]').forEach(el=>el.textContent=w(visibility));
      root.querySelectorAll('[data-visibility-choice]').forEach(el=>{
        const selected=el.dataset.visibilityChoice===visibility;
        el.classList.toggle('selected',selected);el.querySelector('.icon').textContent=selected?'check':'chevron_right';
      });
      return;
    }
  });
  document.addEventListener('keydown',event=>{
    const current=layers.at(-1);if(!current)return;
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();closeLayer();return;}
    if(event.key==='Tab'){
      const focusable=[...current.element.querySelectorAll('button,input,a[href]')].filter(el=>!el.disabled);
      const first=focusable[0],last=focusable.at(-1);if(!first)return;
      if(!current.element.contains(document.activeElement)||document.activeElement===current.element.querySelector('.ui-surface')){event.preventDefault();(event.shiftKey?last:first).focus();}
      else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  },true);
}
