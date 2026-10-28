/* eslint-disable */
// In-browser video compression with WebCodecs: re-encodes to H.264 MP4 (max 1080p, ~0.075 bits/pixel),
// copies AAC audio untouched. Returns the original file whenever it can't safely do better.
const MIN_BYTES = 25 * 1024 * 1024
const WIN = 8 * 1024 * 1024
const cache = new WeakMap()

var sleep=function(ms){return new Promise(function(r){setTimeout(r,ms)})};
function cat(a,b){var o=new Uint8Array(a.length+b.length);o.set(a,0);o.set(b,a.length);return o}
async function readHeader(file){
  var pos=0,ftyp=new Uint8Array(0),moov=null;
  while(pos<file.size){
    var dv=new DataView(await file.slice(pos,pos+16).arrayBuffer());
    var size=dv.getUint32(0),type=String.fromCharCode(dv.getUint8(4),dv.getUint8(5),dv.getUint8(6),dv.getUint8(7));
    if(size===1)size=Number(dv.getBigUint64(8));else if(size===0)size=file.size-pos;
    if(size<8)throw new Error("bad box");
    if(type==="ftyp")ftyp=new Uint8Array(await file.slice(pos,pos+size).arrayBuffer());
    if(type==="moov")moov=new Uint8Array(await file.slice(pos,pos+size).arrayBuffer());
    pos+=size;
  }
  if(!moov)throw new Error("no moov");
  return cat(ftyp,moov);
}
function codecDesc(trak,DataStream){
  var es=trak.mdia.minf.stbl.stsd.entries;
  for(var i=0;i<es.length;i++){var b=es[i].avcC||es[i].hvcC;if(b){var s=new DataStream(undefined,0,DataStream.BIG_ENDIAN);b.write(s);return new Uint8Array(s.buffer,8)}}
}
function aacDesc(trak){
  var e=trak.mdia.minf.stbl.stsd.entries[0];
  return new Uint8Array(e.esds.esd.descs[0].descs[0].data);
}
async function run(file,onProg,useCanvas){
  if(file.size<MIN_BYTES)return file;
  if(!window.VideoEncoder||!window.VideoDecoder||!window.EncodedVideoChunk)return file;
  const [mb, Mp4Muxer] = await Promise.all([import('mp4box'), import('mp4-muxer')]);
  const MP4Box = mb.default || mb, DataStream = MP4Box.DataStream;
  var buf=(await readHeader(file)).buffer;buf.fileStart=0;
  var mp4=MP4Box.createFile(),info=null;
  mp4.onReady=function(i){info=i};mp4.onError=function(e){throw e};
  mp4.appendBuffer(buf);mp4.flush();
  if(!info||!info.videoTracks.length)return file;
  var vt=info.videoTracks[0],at=info.audioTracks[0]||null;
  var vtrak=mp4.getTrackById(vt.id),vs=vtrak.samples;
  var m=vtrak.tkhd&&vtrak.tkhd.matrix;
  if(m&&(m[0]!==65536||m[4]!==65536||m[1]!==0||m[3]!==0))return file; // rotated video: leave alone
  var as=null,atrak=null;
  if(at){if(at.codec.indexOf("mp4a.40")!==0)return file;atrak=mp4.getTrackById(at.id);as=atrak.samples}
  var dur=vt.duration/vt.timescale,fps=vs.length/dur;
  var sw=vt.video.width,sh=vt.video.height,k=Math.min(1,1920/sw,1080/sh);
  var W=Math.floor(sw*k/2)*2,H=Math.floor(sh*k/2)*2,scale=(W!==sw||H!==sh);
  var target=Math.round(Math.min(10e6,Math.max(1.5e6,W*H*fps*0.075)));
  if(file.size*8/dur<target*1.4)return file; // already small enough
  var vdesc=codecDesc(vtrak,DataStream);
  var dcfg={codec:vt.codec,codedWidth:sw,codedHeight:sh};if(vdesc)dcfg.description=vdesc;
  var ecfg={codec:"avc1.64002A",width:W,height:H,bitrate:target,framerate:fps,latencyMode:"quality",bitrateMode:"variable",avc:{format:"avc"}};
  if(!(await VideoDecoder.isConfigSupported(dcfg)).supported)return file;
  if(!(await VideoEncoder.isConfigSupported(ecfg)).supported)return file;
  var mopts={target:new Mp4Muxer.ArrayBufferTarget(),video:{codec:"avc",width:W,height:H,frameRate:fps},fastStart:"in-memory",firstTimestampBehavior:"cross-track-offset"};
  if(at)mopts.audio={codec:"aac",numberOfChannels:at.audio.channel_count,sampleRate:at.audio.sample_rate};
  var muxer=new Mp4Muxer.Muxer(mopts),err=null,n=0,gop=Math.max(1,Math.round(fps*2));
  var cv=scale&&useCanvas?new OffscreenCanvas(W,H):null,ctx=cv&&cv.getContext("2d");
  if(ctx)ctx.imageSmoothingQuality="high";
  var enc=new VideoEncoder({output:function(c,md){muxer.addVideoChunk(c,md)},error:function(e){err=e}});
  enc.configure(ecfg);
  var dec=new VideoDecoder({output:function(f){
    try{
      var g=f;
      if(scale&&useCanvas){ctx.drawImage(f,0,0,W,H);g=new VideoFrame(cv,{timestamp:f.timestamp,duration:f.duration||undefined});f.close()}
      enc.encode(g,{keyFrame:n%gop===0});g.close();n++;
    }catch(e){err=e}
  },error:function(e){err=e}});
  dec.configure(dcfg);
  var items=vs.map(function(s){return{v:1,s:s}});
  if(as)items=items.concat(as.map(function(s){return{v:0,s:s}}));
  items.sort(function(a,b){return a.s.offset-b.s.offset});
  var adesc=at?aacDesc(atrak):null,firstA=true,ws=0,wb=null,started=false,sent=0;
  var us=function(s,x){return Math.round(x*1e6/s.timescale)};
  for(var i=0;i<items.length;i++){
    if(err)throw err;
    var s=items[i].s;
    if(!wb||s.offset<ws||s.offset+s.size>ws+wb.byteLength){ws=s.offset;wb=new Uint8Array(await file.slice(s.offset,s.offset+Math.max(s.size,WIN)).arrayBuffer())}
    var data=wb.subarray(s.offset-ws,s.offset-ws+s.size);
    if(items[i].v){
      if(!started&&!s.is_sync)continue;
      started=true;
      dec.decode(new EncodedVideoChunk({type:s.is_sync?"key":"delta",timestamp:us(s,s.cts),duration:us(s,s.duration),data:data}));
      sent++;
      while(dec.decodeQueueSize>6||enc.encodeQueueSize>6){await sleep(4);if(err)throw err}
      if(onProg&&sent%20===0)onProg(sent/vs.length);
    }else{
      var meta=firstA?{decoderConfig:{codec:at.codec,numberOfChannels:at.audio.channel_count,sampleRate:at.audio.sample_rate,description:adesc}}:undefined;
      firstA=false;
      muxer.addAudioChunkRaw(data.slice(),"key",us(s,s.cts),us(s,s.duration),meta);
    }
  }
  await dec.flush();await enc.flush();
  if(err)throw err;
  dec.close();enc.close();muxer.finalize();
  var out=new File([muxer.target.buffer],file.name.replace(/\.[^.]*$/,"")+".mp4",{type:"video/mp4"});
  if(onProg)onProg(1);
  return out.size<file.size*0.9?out:file;
}

export function compressVideo (file, onProgress) {
	if (!cache.has(file)) {
		cache.set(file, run(file, onProgress, false)
			.catch((e) => { console.warn('Direct scaling failed, retrying via canvas:', e); return run(file, onProgress, true) })
			.catch((e) => { console.warn('Video compression skipped:', e); return file }))
	}
	return cache.get(file)
}
