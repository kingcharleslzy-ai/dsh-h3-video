window.__ModuleLoader__.load({id:'dsh-h3-video', factory(require) {
  const {createElement:h, useState, useEffect, useRef} = require('react');
  const base = '/api/h3-video/';
  const pendingKey = 'dsh-h3-video.pending';
  const modes = [['turbo480','480p · Turbo'],['turbo768','768p · Turbo'],['quality480','480p · 质量'],['quality768','768p · 质量']];
  const labels = {queued:'已排队',running:'生成中',complete:'已完成',failed:'生成失败',unknown:'等待确认'};
  const url = id => base+'video?id='+encodeURIComponent(id);
  async function api(route, data) {
    const response = await fetch(base+route, data ? {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)} : {cache:'no-store'});
    const value = await response.json();
    if(!response.ok) throw Error(value.error || '请求失败');
    return value;
  }
  const css = `
    .h3page{box-sizing:border-box;height:100%;overflow:auto;padding:clamp(18px,4vw,54px);padding-top:max(32px,var(--dsh-frame-top-clearance,0px));font-family:"Instrument Sans",sans-serif;font-size:14px;line-height:1.55;color:inherit}
    .h3page *{box-sizing:border-box}.h3wrap{max-width:1080px;margin:0 auto}.h3page h1{font-size:clamp(28px,4vw,44px);line-height:1.08;margin:0 0 6px;letter-spacing:-.04em}.h3page h2{margin:0 0 12px;font-size:16px}
    .h3head{border-bottom:1px solid color-mix(in srgb,currentColor 20%,transparent);margin-bottom:24px;padding:8px 0 20px;display:flex;justify-content:space-between;align-items:end;gap:12px}.h3page small,.h3meta{opacity:.72}
    .h3grid{display:grid;grid-template-columns:minmax(240px,5fr) minmax(270px,7fr);gap:clamp(16px,3vw,40px)}.h3form{display:grid;gap:14px;align-content:start}.h3form label{display:grid;gap:5px;font-weight:600}
    .h3page textarea,.h3page select,.h3page input,.h3page button,.h3page a{font:inherit}.h3page textarea,.h3page select,.h3page input{border:1px solid color-mix(in srgb,currentColor 28%,transparent);border-radius:5px;color:inherit;background:transparent;padding:9px;width:100%}.h3page select option{color:CanvasText;background:Canvas}
    .h3page textarea{resize:vertical;min-height:130px}.h3options{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .h3page button,.h3page a{color:inherit;cursor:pointer}.h3page button{border:1px solid color-mix(in srgb,currentColor 25%,transparent);background:transparent;border-radius:5px;padding:7px 12px}
    .h3page button:disabled{opacity:.45;cursor:default}.h3page .h3go{background:#a7e8c0;color:#112d20;border-color:#75ae8b;font-weight:700;padding:11px}.h3screen{background:#121b18;color:#bcd4c6;aspect-ratio:16/9;display:grid;place-items:center;border-radius:7px;overflow:hidden}.h3screen video{width:100%;height:100%;object-fit:contain}
    .h3foot{margin-top:9px;display:flex;align-items:center;justify-content:space-between}.h3clips{display:flex;flex-wrap:wrap;gap:8px}.h3clips button[aria-pressed=true]{border-color:#489065;font-weight:700}
    .h3collection{margin-top:28px;border-top:1px solid color-mix(in srgb,currentColor 17%,transparent);padding-top:18px}.h3msg{overflow-wrap:anywhere}.h3page :focus-visible{outline:2px solid #449765;outline-offset:3px}
    @media(max-width:720px){.h3grid{grid-template-columns:1fr}.h3page{padding:16px}.h3head{align-items:center}}
  `;
  function Page() {
    const [prompt,setPrompt]=useState(''),[preset,setPreset]=useState('turbo480'),[seed,setSeed]=useState('');
    const [duration,setDuration]=useState('5');
    const [invalidRefs,setInvalidRefs]=useState(false),[refs,setRefs]=useState([]),[uploading,setUploading]=useState(false);
    const seconds=Number(duration);
    const validDuration=Number.isFinite(seconds) && seconds>=1 && seconds<=15;
    const [pending,setPending]=useState(()=>localStorage.getItem(pendingKey)||'');
    const [sending,setSending]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
    const [clips,setClips]=useState([]),[selected,setSelected]=useState('');
    const submitLock=useRef(false);
    async function refresh() {
      const items=await api('gallery'); setClips(items);
      setSelected(old=>old || items[0]?.id || '');
    }
    useEffect(()=>{refresh().catch(e=>setError(e.message));},[]);
    useEffect(()=>{
      if(!pending || sending) return;
      let stopped=false, timer;
      async function poll(){
        try{
          const job=await api('status',{id:pending});
          if(stopped)return;
          const timing=job.frames ? ' · '+job.frames+' 帧 · '+job.actual_seconds.toFixed(2)+' 秒' : '';
          setError(''); setMessage((labels[job.status] || job.status)+timing);
          if(job.status==='complete' || job.status==='failed'){
            localStorage.removeItem(pendingKey); setPending('');
            if(job.status==='failed')setError(job.message || '生成失败');
            else{setSelected(pending);await refresh();}
            return;
          }
        }catch(e){if(!stopped)setError(e.message);}
        if(!stopped)timer=setTimeout(poll,4500);
      }
      poll();return ()=>{stopped=true;clearTimeout(timer);};
    },[pending,sending]);
    async function loadRefs(files){
      setInvalidRefs(false);
      if(!files.length){setRefs([]);return;}
      setUploading(true);setError('');
      try{
        if(files.length>9)throw Error('每镜最多 9 张参考图');
        const items=[];
        for(const file of files){
          if(file.size>16*1024*1024)throw Error('图片超过 16 MiB');
          const res=await fetch(base+'reference',{method:'POST',headers:{'content-type':file.type},body:file});
          const value=await res.json();
          if(!res.ok)throw Error(value.error);
          if(items.some(item=>item.id===value.id))throw Error('同一张参考图只能选择一次');
          items.push({name:file.name,id:value.id});
        }
        setRefs(items);setPreset(old=>old.replace('turbo','quality'));
      }catch(e){setInvalidRefs(true);setRefs([]);setError(e.message);}finally{setUploading(false);}
    }
    async function generate(){
      if(submitLock.current || pending || !prompt.trim() || !validDuration)return;
      if(seed!=='' && (!Number.isInteger(Number(seed)) || Number(seed)<0 || Number(seed)>2147483647)){setError('种子范围为 0–2147483647');return;}
      submitLock.current=true;setSending(true);setError('');setMessage('正在连接 H3…');
      const id=crypto.randomUUID();localStorage.setItem(pendingKey,id);setPending(id);
      try{await api('generate',{id,prompt,preset,reference_images:refs.map(r=>r.id),duration_seconds:seconds,...(seed!==''?{seed:Number(seed)}:{})});setMessage('已提交');}
      catch(e){setError(e.message);setMessage('可按任务 ID 查询提交结果');}
      finally{submitLock.current=false;setSending(false);}
    }
    async function release(){setError('');try{const r=await api('release',{});setMessage(({released:'显卡已释放，可切回 Qwen 生图。',busy:'队列或视频调度器仍在使用显卡。',shared:'当前没有由本插件启动的工作台。'})[r.status] || r.message);}catch(e){setError(e.message);}}
    return h('main',{className:'h3page'},h('style',null,css),h('div',{className:'h3wrap'},
      h('header',{className:'h3head'},h('div',null,h('h1',null,'视频'),h('span',{className:'h3meta'},'MiniMax H3')),h('button',{onClick:release,disabled:!!pending},'释放显卡')),
      h('div',{className:'h3grid'},h('section',{className:'h3form'},
        h('label',null,'画面与声音',h('textarea',{value:prompt,maxLength:12000,onChange:e=>setPrompt(e.target.value),placeholder:'描述主体、动作、镜头和环境声…'})),
        h('label',null,'人物 / 参考图（可选，最多 9 张）',h('input',{type:'file',accept:'image/jpeg,image/png,image/webp',multiple:true,disabled:uploading||sending,onChange:e=>loadRefs(Array.from(e.target.files))})),
        (invalidRefs || refs.length>0) && h('button',{onClick:e=>{e.currentTarget.parentElement.querySelector('input[type=file]').value='';setRefs([]);setInvalidRefs(false);setError('');},disabled:uploading},'清空参考图'),
        uploading && h('small',null,'正在导入参考图…'),
        refs.length>0 && h('small',null,refs.map((r,i)=>'<Picture '+(i+1)+'> '+r.name).join(' · ')),
        h('div',{className:'h3options'},h('label',null,'生成档位',h('select',{value:preset,onChange:e=>setPreset(e.target.value)},modes.filter(([id])=>!refs.length||id.startsWith('quality')).map(([id,label])=>h('option',{key:id,value:id},label)))),
          h('label',null,'随机种子',h('input',{type:'number',min:0,max:2147483647,value:seed,onChange:e=>setSeed(e.target.value),placeholder:'自动'}))),
        h('label',null,'单镜时长（秒）',h('input',{type:'number',min:1,max:15,step:'any',value:duration,onChange:e=>setDuration(e.target.value),'aria-invalid':!validDuration})),
        h('small',null,validDuration?'24 fps · 帧数按 H3 支持的长度向上对齐':'请输入 1–15 秒'),h('button',{className:'h3go',onClick:generate,disabled:uploading||invalidRefs||!validDuration||!prompt.trim()||!!pending||sending},pending?'正在处理…':'生成视频'),
        h('div',{className:'h3msg',role:'status'},message),error && h('div',{className:'h3msg',role:'alert'},error),
        pending && h('small',null,'任务 ',pending),pending && !sending && error && h('button',{onClick:()=>{localStorage.removeItem(pendingKey);setPending('');setMessage('已停止跟踪；原任务可在对话中按 ID 查询。');}},'停止跟踪此任务')),
        h('section',null,h('h2',null,'成片预览'),h('div',{className:'h3screen'},selected?h('video',{key:selected,src:url(selected),controls:true,preload:'metadata'}):h('span',null,'完成后可在这里播放')),
          selected && h('div',{className:'h3foot'},h('small',null,selected.slice(0,8)),h('a',{href:url(selected),download:'H3-'+selected+'.mp4'},'下载 MP4')))),
      h('section',{className:'h3collection'},h('div',{className:'h3foot'},h('h2',null,'最近成片'),h('button',{onClick:()=>refresh().catch(e=>setError(e.message))},'刷新')),
        clips.length?h('div',{className:'h3clips'},clips.map(clip=>h('button',{key:clip.id,'aria-pressed':selected===clip.id,onClick:()=>setSelected(clip.id)},new Date(clip.time).toLocaleString()+' · '+clip.id.slice(0,6)))):h('small',null,'尚无已下载的视频'))));
  }
  function Icon({size=16}) {return h('svg',{width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,'aria-hidden':true},h('rect',{x:3,y:5,width:18,height:14,rx:2}),h('path',{d:'M3 9h18M7 5l3 4m3-4 3 4m-6 3 4 2-4 2z'}));}
  return {inject:['slots'],apply(ctx){
    for(const [slot,options,view] of [
      ['main',{key:'h3-video',inject:()=>({})},Page],
      ['sidebar.panellist',{id:'h3-video',order:11,label:'视频'},Icon],
    ])ctx.slots.inject(slot,()=>ctx.slots.register({name:slot,...options},view));
  }};
}});
