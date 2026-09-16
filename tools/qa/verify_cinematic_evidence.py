"""Evidence integrity gate, schema 2. Reviewer identity/art verdicts remain assertions.

build.dependencies_sha256 and each evidence.build_fingerprint must equal
fingerprint(root). Motion requires hashed ue_frame_log and actions_reviewed.
Performance artifact CSV columns: timestamp_seconds,frame_ms (real-time samples).
"""
import argparse, csv, hashlib, json, math, re, shutil, struct, subprocess, sys, zlib
from pathlib import Path

PROJECT = 'ue/NeonCleanerUE/'
BUILD_PATHS = {'runtime_binary': PROJECT+'Binaries/Win64/UnrealEditor-NeonCleanerUE.dll',
               'map': PROJECT+'Content/LinxiaChase/LVL_Linxia_MotorcycleChase.umap'}
DOMAIN_VIEWS = {
 'engineering': {'gameplay','build_log','map_validation','asset_validation','smoke_clean','smoke_damaged','smoke_lost','input_collision'},
 'environment': {'gameplay','bridge_wide','bridge_side'},
 'assets': {'rider_front','enemy_three_quarter','materials_neutral','materials_lit','asset_manifest'},
 'rider': {'rider_front','rider_side','rider_rear','palm_left','palm_right','feet_seat','rider_motion'},
 'vehicles': {'enemy_side','enemy_three_quarter','vehicle_measurements','rider_motion'},
 'temporal': {'rider_motion','performance'},
 'ai_handoff': {'handoff_first','handoff_last','camera_manifest'}}
DOMAINS = tuple(DOMAIN_VIEWS)
REQUIRED_VIEWS = set().union(*DOMAIN_VIEWS.values())
DATA_VIEWS = {'build_log','map_validation','asset_validation','smoke_clean','smoke_damaged','smoke_lost','input_collision','asset_manifest','vehicle_measurements','camera_manifest','performance','rider_motion'}
IMAGE_VIEWS = REQUIRED_VIEWS - DATA_VIEWS

def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024*1024), b''): digest.update(chunk)
    return digest.hexdigest()

def fingerprint(root):
    root = Path(root).resolve()
    base = root / PROJECT
    paths = [base/'NeonCleanerUE.uproject', root/BUILD_PATHS['runtime_binary']]
    extensions = {'.uasset','.umap','.ubulk','.uexp','.ini','.cpp','.h','.hpp','.inl','.cs','.usf','.ush',
                  '.json','.mp4','.mov','.mkv','.wav','.mp3','.png','.jpg','.jpeg','.exr','.tga'}
    for folder in ('Content','Config','Source'):
        directory = base/folder
        if not directory.is_dir(): raise ValueError('Missing dependency directory: '+folder)
        paths += [p for p in directory.rglob('*') if p.is_file() and p.suffix.lower() in extensions]
    digest = hashlib.sha256()
    for p in sorted(set(paths), key=lambda x:x.as_posix()):
        digest.update((p.relative_to(root).as_posix()+'\0'+sha256(p)+'\n').encode())
    return digest.hexdigest()

def png_dimensions(path):
    data = path.read_bytes()
    if data[:8] != b'\x89PNG\r\n\x1a\n': raise ValueError('Invalid PNG signature')
    offset, header, compressed, ended = 8, None, bytearray(), False
    while offset < len(data):
        if len(data)-offset < 12: raise ValueError('Truncated PNG')
        length = struct.unpack_from('>I',data,offset)[0]
        kind = data[offset+4:offset+8]
        body = data[offset+8:offset+8+length]
        end = offset+length+12
        if end > len(data) or zlib.crc32(kind+body) != struct.unpack_from('>I',data,end-4)[0]: raise ValueError('PNG CRC/length error')
        if kind == b'IHDR':
            if offset != 8 or length != 13: raise ValueError('Invalid IHDR')
            header = struct.unpack('>IIBBBBB',body)
        elif kind == b'IDAT': compressed.extend(body)
        elif kind == b'IEND':
            ended = length == 0 and end == len(data)
            break
        offset = end
    if not header or not ended: raise ValueError('Incomplete PNG')
    w,h,depth,color,compression,filtering,interlace = header
    channels = {0:1,2:3,4:2,6:4}.get(color)
    if not channels or depth not in (8,16) or compression or filtering or interlace: raise ValueError('Use noninterlaced RGB/RGBA PNG')
    stride = w*channels*(depth//8)+1
    expected = stride*h
    if not (0<w<=16384 and 0<h<=16384) or expected>256*1024*1024: raise ValueError('PNG dimensions/decode budget')
    decoder = zlib.decompressobj()
    raw = decoder.decompress(compressed,expected+1)
    if not decoder.eof or decoder.unused_data or len(raw)!=expected: raise ValueError('PNG scanline decode failed')
    if any(raw[i]>4 for i in range(0,expected,stride)): raise ValueError('Invalid PNG filter')
    return w,h

def video_metadata(path,root):
    exe = shutil.which('ffmpeg')
    bundled = root/'.local/tools/python-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
    if not exe and bundled.is_file(): exe = str(bundled)
    if not exe: raise ValueError('ffmpeg unavailable')
    result = subprocess.run([exe,'-hide_banner','-i',str(path)],capture_output=True,text=True,timeout=30)
    output = result.stderr
    duration = re.search(r'Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)',output)
    stream = next((s for s in output.splitlines() if 'Video:' in s),'')
    size = re.search(r'\b(\d{2,5})x(\d{2,5})\b',stream)
    rate = re.search(r'\b(\d+(?:\.\d+)?) fps\b',stream)
    if not duration or not size or not rate: raise ValueError('Invalid actual video stream')
    decoded = subprocess.run([exe,'-v','error','-xerror','-i',str(path),'-map','0:v:0','-f','null','-'],capture_output=True,text=True,timeout=60)
    if decoded.returncode: raise ValueError('Video decode failed')
    return int(duration[1])*3600+int(duration[2])*60+float(duration[3]),float(rate[1]),int(size[1]),int(size[2])

def motion_log_valid(path,seconds,fps):
    text = path.read_text(encoding='utf8',errors='replace')
    frames = [(int(a),float(b)) for a,b in re.findall(r'\[NeonRiderVideo\] frame=(\d+) t=([\d.]+)',text)]
    if len(frames)<math.ceil(10*fps) or '[NeonRiderVideo] Completed requestedFrames=' not in text: raise ValueError('Missing complete UE frame provenance')
    for i,(index,timestamp) in enumerate(frames):
        if index!=i or not math.isfinite(timestamp) or (i and abs(timestamp-frames[i-1][1]-1/fps)>.003): raise ValueError('UE frame gaps/timing mismatch')
    if abs(len(frames)/fps-seconds)>max(.1,1/fps): raise ValueError('UE log/video durations disagree')

def performance_stats(path):
    with path.open(encoding='utf-8-sig',newline='') as stream: rows=list(csv.DictReader(stream))
    if len(rows)<2: raise ValueError('Raw performance samples missing')
    times=[float(row['timestamp_seconds']) for row in rows]
    values=[float(row['frame_ms']) for row in rows]
    if any(not math.isfinite(t) for t in times+values) or any(v<=0 for v in values): raise ValueError('Invalid performance numbers')
    if any(b<=a for a,b in zip(times,times[1:])): raise ValueError('Performance timestamps must increase')
    duration=times[-1]-times[0]
    if abs(sum(values[1:])/1000-duration)>max(.5,duration*.03): raise ValueError('Frame times do not cover wall-clock interval')
    ordered=sorted(values)
    def percentile(q):
        p=(len(ordered)-1)*q; lo=int(p); hi=min(lo+1,len(ordered)-1)
        return ordered[lo]+(ordered[hi]-ordered[lo])*(p-lo)
    return duration,percentile(.5),percentile(.95)

def verify(report,root):
    root=Path(root).resolve(); errors=[]
    def require(ok,message):
        if not ok: errors.append(message)
    def record(item,label):
        path=(root/item.get('path','__missing__')).resolve()
        if not path.is_relative_to(root):
            errors.append(label+': path outside repository'); return root/'__missing__'
        require(path.is_file(),label+': missing file')
        if path.is_file(): require(sha256(path)==item.get('sha256'),label+': SHA256 mismatch')
        return path
    def inspect(function,label,*args):
        try: return function(*args)
        except (OSError,ValueError,TypeError,KeyError,struct.error,zlib.error,subprocess.SubprocessError) as exc:
            errors.append(label+': '+str(exc)); return None
    require(report.get('schema')==2,'Schema 2 required')
    a,b=report.get('producer'),report.get('reviewer')
    require(isinstance(a,str) and isinstance(b,str) and a.strip() and b.strip() and a.strip().casefold()!=b.strip().casefold(),'Independent named reviewer required')
    require(bool(report.get('reviewed_at')) and bool(report.get('engine')),'Review timestamp/engine required')
    build=report.get('build',{})
    for name,canonical in BUILD_PATHS.items():
        path=record(build.get(name,{}),'build/'+name)
        require(path==(root/canonical).resolve(),'build/'+name+': noncanonical path')
        if path.is_file():
            with path.open('rb') as stream:
                header=stream.read(64)
                if name=='runtime_binary':
                    valid=header[:2]==b'MZ' and len(header)==64
                    if valid:
                        stream.seek(struct.unpack_from('<I',header,60)[0]); valid=stream.read(4)==b'PE\0\0'
                else: valid=header[:4]==b'\xc1\x83\x2a\x9e'
            require(valid,'build/'+name+': invalid binary signature')
    current=inspect(fingerprint,'dependencies',root)
    require(bool(current) and current==build.get('dependencies_sha256'),'Dependency fingerprint missing/stale')
    evidence=report.get('evidence',[]); ids=[e.get('id') for e in evidence]
    require(all(isinstance(i,str) and i.strip() for i in ids) and len(ids)==len(set(ids)),'Unique artifact IDs required')
    views=set(); by_id={}; image_hashes={}
    for item in evidence:
        label=str(item.get('id')); view=item.get('view'); path=record(item,label)
        views.add(view); by_id[item.get('id')]=view
        require(view in REQUIRED_VIEWS,label+': unknown view')
        require(item.get('reviewed') is True and bool(item.get('notes')),label+': independent review notes required')
        require(bool(current) and item.get('build_fingerprint')==current,label+': build not bound')
        if view in IMAGE_VIEWS:
            require(path.suffix.lower()=='.png',label+': image view requires PNG')
            size=inspect(png_dimensions,label,path)
            require(size and size[0]>=1920 and size[1]>=1080,label+': requires decoded 1920x1080 image')
            image_hashes.setdefault(item.get('sha256'),set()).add(view)
        elif view=='rider_motion':
            require(path.suffix.lower() in ('.mp4','.mov','.mkv'),label+': motion must be video')
            metadata=inspect(video_metadata,label,path,root)
            log=record(item.get('ue_frame_log',{}),label+'/ue_frame_log')
            require(path.parent==log.parent,label+': video and UE log must belong to the same capture directory')
            if metadata:
                seconds,fps,w,h=metadata
                require(seconds>=10 and fps>=24 and w>=1920 and h>=1080,label+': actual video below target')
                inspect(motion_log_valid,label,log,seconds,fps)
            require({'neutral','left','right','return','brake'}<=set(item.get('actions_reviewed',[])),label+': full action review missing')
        elif view=='performance':
            require(path.suffix.lower()=='.csv',label+': raw performance CSV required')
            stats=inspect(performance_stats,label,path)
            if stats:
                duration,p50,p95=stats
                require(duration>=30 and p95<=33.3,label+': measured duration/p95 misses target')
                for key,value in [('duration_seconds',duration),('p50_frame_ms',p50),('p95_frame_ms',p95)]:
                    claimed=report.get('performance',{}).get(key)
                    if claimed is not None: require(isinstance(claimed,(int,float)) and abs(claimed-value)<=.1,label+': claimed '+key+' differs from raw data')
        else:
            require(path.suffix.lower() in ('.log','.json','.txt','.csv'),label+': structured metadata/log required')
            require(path.is_file() and path.stat().st_size>0,label+': empty evidence')
    for group in image_hashes.values(): require(len(group)==1,'Same image reused for distinct views: '+', '.join(sorted(group)))
    require(REQUIRED_VIEWS<=views,'Missing views: '+', '.join(sorted(REQUIRED_VIEWS-views)))
    for domain,needed in DOMAIN_VIEWS.items():
        gate=report.get('domains',{}).get(domain,{})
        require(gate.get('verdict')=='PASS' and bool(gate.get('notes')),domain+': independent PASS/findings required')
        refs=gate.get('evidence',[])
        require(bool(refs) and set(refs)<=set(ids),domain+': missing/unknown references')
        require(needed<={by_id.get(ref) for ref in refs},domain+': domain-specific views not referenced')
    perf=report.get('performance',{})
    require(perf.get('width',0)>=1920 and perf.get('height',0)>=1080,'Performance resolution below target')
    require(bool(perf.get('hardware')) and bool(perf.get('settings')) and perf.get('fixed_timestep') is False,'Real-time performance hardware/settings required')
    require(not report.get('blockers'),'Open cinematic blockers remain')
    return errors

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('report',type=Path)
    parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[2]); args=parser.parse_args()
    try: errors=verify(json.loads(args.report.read_text(encoding='utf-8-sig')),args.root)
    except (OSError,ValueError,TypeError,AttributeError,KeyError,OverflowError) as exc: errors=['Invalid/unavailable evidence: '+str(exc)]
    print('CINEMATIC / UE REFERENCE READINESS: '+('BLOCKED' if errors else 'PASS'))
    for error in errors: print('- '+error)
    return 2 if errors else 0
if __name__=='__main__': sys.exit(main())
