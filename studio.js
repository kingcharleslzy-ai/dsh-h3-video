import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';

export function registerStudio(ctx, { videos, uuid, submitVideo, collect, release }) {
  for (const route of ['gallery','video','generate','status','release']) {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact', path: '/api/h3-video/' + route,
      async handler(req, res) {
        const json = (code, value) => {
          res.writeHead(code, {'content-type':'application/json', 'cache-control':'no-store'});
          res.end(JSON.stringify(value));
        };
        try {
          if (route === 'gallery' && req.method === 'GET') {
            const names = await readdir(videos).catch(e => { if(e.code === 'ENOENT') return []; throw e; });
            const clips = await Promise.all(names.filter(n => n.endsWith('.mp4') && uuid.test(n.slice(0,-4))).map(async n =>
              ({id:n.slice(0,-4), time:(await stat(join(videos,n))).mtimeMs})));
            return json(200, clips.sort((a,b)=>b.time-a.time).slice(0,100));
          }
          if (route === 'video' && req.method === 'GET') {
            const id = new URL(req.url,'http://localhost').searchParams.get('id');
            if (!uuid.test(id || '')) return json(400, {error:'任务 ID 无效'});
            const path = join(videos,id+'.mp4');
            const {size} = await stat(path);
            const range = req.headers.range;
            let start = 0, end = size-1;
            if (range) {
              const m = /^bytes=(\d+)-(\d*)$/.exec(range);
              if (!m || (start=Number(m[1])) >= size || (end=m[2] ? Math.min(end,Number(m[2])) : end) < start) {
                res.writeHead(416,{'content-range':'bytes */'+size}); return res.end();
              }
            }
            res.writeHead(range ? 206 : 200, {'content-type':'video/mp4','accept-ranges':'bytes',
              'content-length':end-start+1,...(range ? {'content-range':`bytes ${start}-${end}/${size}`} : {})});
            await pipeline(createReadStream(path,{start,end}),res);
            return;
          }
          if(req.method !== 'POST' || !['generate','status','release'].includes(route)) return json(405,{error:'请求方法无效'});
          if(req.headers['content-type']?.split(';')[0] !== 'application/json') return json(415,{error:'需要 JSON 请求'});
          if(req.headers['sec-fetch-site']==='cross-site') return json(403,{error:'来源无效'});
          const chunks = []; let count = 0;
          for await (const chunk of req) { count += chunk.length; if(count>65536) return json(413,{error:'描述过长'}); chunks.push(chunk); }
          const data=JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
          if(route === 'release') return json(200,await release());
          if(!uuid.test(data.id || '')) return json(400,{error:'任务 ID 无效'});
          if(route === 'status') return json(200,await collect(data.id,undefined,0));
          const job=await submitVideo(data,data.id);
          return json(202,{id:job.id,status:job.status || 'queued',frames:job.frames,actual_seconds:job.actual_seconds});
        } catch(e) {
          if(!res.headersSent && !res.destroyed) json(e.code==='ENOENT' ? 404 : 400,{error:e.message});
        }
      },
    }), 'H3 studio ' + route);
  }
}
