// World Cup 2026 match image storage Worker
// 功能：前端 -> Cloudflare Worker -> GitHub 私有/公开仓库
// 需要在 Cloudflare Worker Variables and secrets 配置：
// Secret:    GH_TOKEN, APP_PASSWORD
// Plaintext: GH_OWNER, GH_REPO, GH_BRANCH, IMAGE_ROOT

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Max-Age': '86400'
};

function json(data, status = 200){
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store, no-cache, must-revalidate', ...CORS_HEADERS}
  });
}
function text(data, status = 200){
  return new Response(data, {status, headers: {'Content-Type':'text/plain; charset=utf-8', 'Cache-Control':'no-store, no-cache, must-revalidate', ...CORS_HEADERS}});
}
function cleanSlash(value){ return String(value || '').replace(/^\/+|\/+$/g, ''); }
function envValue(env, key, fallback = ''){ return String(env && env[key] ? env[key] : fallback); }
function ghOwner(env){ return envValue(env, 'GH_OWNER'); }
function ghRepo(env){ return envValue(env, 'GH_REPO'); }
function ghBranch(env){ return envValue(env, 'GH_BRANCH', 'main'); }
function imageRoot(env){ return cleanSlash(envValue(env, 'IMAGE_ROOT', 'worldcup-cloud/match-images')); }
function encodePath(path){ return cleanSlash(path).split('/').map(encodeURIComponent).join('/'); }
function githubApiBase(env){ return `https://api.github.com/repos/${encodeURIComponent(ghOwner(env))}/${encodeURIComponent(ghRepo(env))}`; }
function githubHeaders(env, accept = 'application/vnd.github+json'){
  const headers = {
    'Accept': accept,
    'User-Agent': 'worldcup-2026-image-worker'
  };
  if(env && env.GH_TOKEN) headers.Authorization = `Bearer ${env.GH_TOKEN}`;
  return headers;
}
function extContentType(path){
  const p = String(path || '').toLowerCase();
  if(p.endsWith('.png')) return 'image/png';
  if(p.endsWith('.webp')) return 'image/webp';
  if(p.endsWith('.gif')) return 'image/gif';
  if(p.endsWith('.heic')) return 'image/heic';
  if(p.endsWith('.heif')) return 'image/heif';
  return 'image/jpeg';
}
function safeFileName(value){
  const raw = String(value || '').trim().toLowerCase();
  const cleaned = raw.replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || `${Date.now()}-${Math.random().toString(36).slice(2,8)}.jpg`;
}
function safeMatchKey(value){
  const raw = String(value || '').trim().toLowerCase();
  return raw.replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 140) || 'unknown-match';
}
function bytesToBase64(bytes){
  let binary = '';
  const chunk = 0x8000;
  for(let i = 0; i < bytes.length; i += chunk){
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
function base64ToUtf8(b64){
  const clean = String(b64 || '').replace(/\s+/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
function utf8ToBase64(textValue){
  return bytesToBase64(new TextEncoder().encode(String(textValue || '')));
}
async function parseJsonBody(request){
  try{return await request.json();}catch(e){return null;}
}
function assertRepoEnv(env){
  if(!ghOwner(env) || !ghRepo(env) || !env.GH_TOKEN){
    return 'Missing GH_OWNER, GH_REPO or GH_TOKEN in Cloudflare Worker variables.';
  }
  return '';
}
function checkPassword(body, env){
  const expected = String(env && env.APP_PASSWORD ? env.APP_PASSWORD : '');
  if(!expected) return false;
  return String(body && body.password ? body.password : '') === expected;
}
async function getContentMeta(env, path){
  const url = `${githubApiBase(env)}/contents/${encodePath(path)}?ref=${encodeURIComponent(ghBranch(env))}`;
  const res = await fetch(url, {headers: githubHeaders(env)});
  if(res.status === 404) return null;
  if(!res.ok) throw new Error(`GitHub get failed ${res.status}: ${await res.text()}`);
  return await res.json();
}
async function getJsonFile(env, path, fallback){
  const meta = await getContentMeta(env, path);
  if(!meta || !meta.content) return {data:fallback, sha:null};
  const data = JSON.parse(base64ToUtf8(meta.content));
  return {data, sha:meta.sha || null};
}
async function putBase64File(env, path, base64Content, message, sha){
  const url = `${githubApiBase(env)}/contents/${encodePath(path)}`;
  const body = {message, content:String(base64Content || '').replace(/^data:[^,]+,/, '').replace(/\s+/g, ''), branch:ghBranch(env)};
  if(sha) body.sha = sha;
  const res = await fetch(url, {
    method:'PUT',
    headers:{...githubHeaders(env), 'Content-Type':'application/json; charset=utf-8'},
    body:JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error(`GitHub put failed ${res.status}: ${JSON.stringify(data)}`);
  return data;
}
async function putJsonFile(env, path, data, message, sha){
  return putBase64File(env, path, utf8ToBase64(JSON.stringify(data, null, 2)), message, sha);
}
async function deleteGithubFile(env, path, message, sha){
  const url = `${githubApiBase(env)}/contents/${encodePath(path)}`;
  const body = {message, sha, branch:ghBranch(env)};
  const res = await fetch(url, {
    method:'DELETE',
    headers:{...githubHeaders(env), 'Content-Type':'application/json; charset=utf-8'},
    body:JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error(`GitHub delete failed ${res.status}: ${JSON.stringify(data)}`);
  return data;
}
function manifestPath(env, matchKey){ return `${imageRoot(env)}/${safeMatchKey(matchKey)}/manifest.json`; }
function normalizeManifest(matchKey, raw){
  const data = raw && typeof raw === 'object' ? raw : {};
  return {
    matchKey: safeMatchKey(data.matchKey || matchKey),
    updatedAt: data.updatedAt || new Date().toISOString(),
    images: Array.isArray(data.images) ? data.images : []
  };
}
async function loadManifest(env, matchKey){
  const path = manifestPath(env, matchKey);
  try{
    const got = await getJsonFile(env, path, {matchKey:safeMatchKey(matchKey), images:[]});
    return {manifest: normalizeManifest(matchKey, got.data), sha: got.sha, path};
  }catch(e){
    if(String(e.message || '').includes('404')) return {manifest: normalizeManifest(matchKey, null), sha:null, path};
    throw e;
  }
}
function publicRecord(env, matchKey, item, uploadResult){
  const root = imageRoot(env);
  const cleanMatch = safeMatchKey(matchKey);
  const fileName = safeFileName(item.fileName || `${Date.now()}.jpg`);
  const path = `${root}/${cleanMatch}/${fileName}`;
  return {
    id: String(item.id || fileName.replace(/\.[^.]+$/, '')),
    fileName,
    path,
    contentType: item.contentType || extContentType(fileName),
    width: item.width || null,
    height: item.height || null,
    size: item.size || null,
    originalName: item.originalName || '',
    originalSize: item.originalSize || null,
    createdAt: item.createdAt || new Date().toISOString(),
    sha: uploadResult && uploadResult.content ? uploadResult.content.sha : null
  };
}
async function listImages(request, env, matchKey){
  const miss = assertRepoEnv(env);
  if(miss) return json({ok:false, message:miss}, 500);
  const {manifest} = await loadManifest(env, matchKey);
  return json({ok:true, matchKey:safeMatchKey(matchKey), images:manifest.images || []});
}
async function uploadImages(request, env, matchKey){
  const miss = assertRepoEnv(env);
  if(miss) return json({ok:false, message:miss}, 500);
  const body = await parseJsonBody(request);
  if(!checkPassword(body, env)) return json({ok:false, message:'Invalid password'}, 401);
  const images = Array.isArray(body && body.images) ? body.images : [];
  if(!images.length) return json({ok:false, message:'No images'}, 400);
  if(images.length > 20) return json({ok:false, message:'Too many images. Max 20 per request.'}, 400);

  const cleanMatch = safeMatchKey(matchKey);
  const {manifest, sha, path:manPath} = await loadManifest(env, cleanMatch);
  const uploaded = [];
  for(const item of images){
    const fileName = safeFileName(item.fileName || `${Date.now()}-${Math.random().toString(36).slice(2,8)}.jpg`);
    const filePath = `${imageRoot(env)}/${cleanMatch}/${fileName}`;
    const content = String(item.base64 || '').replace(/^data:[^,]+,/, '').replace(/\s+/g, '');
    if(!content) continue;
    const put = await putBase64File(env, filePath, content, `upload match image ${cleanMatch}/${fileName}`);
    uploaded.push(publicRecord(env, cleanMatch, {...item, fileName}, put));
  }
  const next = normalizeManifest(cleanMatch, manifest);
  next.updatedAt = new Date().toISOString();
  next.images = [...(next.images || []), ...uploaded];
  await putJsonFile(env, manPath, next, `update image manifest ${cleanMatch}`, sha);
  return json({ok:true, matchKey:cleanMatch, uploaded, images:next.images});
}
async function deleteImage(request, env, matchKey, imageId){
  const miss = assertRepoEnv(env);
  if(miss) return json({ok:false, message:miss}, 500);
  const body = await parseJsonBody(request);
  if(!checkPassword(body, env)) return json({ok:false, message:'Invalid password'}, 401);
  const cleanMatch = safeMatchKey(matchKey);
  const {manifest, sha, path:manPath} = await loadManifest(env, cleanMatch);
  const id = decodeURIComponent(String(imageId || ''));
  const list = Array.isArray(manifest.images) ? manifest.images : [];
  const target = list.find(x => String(x.id) === id || String(x.fileName) === id || String(x.path) === id);
  if(!target) return json({ok:false, message:'Image not found'}, 404);
  const meta = await getContentMeta(env, target.path).catch(() => null);
  if(meta && meta.sha) await deleteGithubFile(env, target.path, `delete match image ${cleanMatch}/${target.fileName || id}`, meta.sha);
  const next = normalizeManifest(cleanMatch, manifest);
  next.updatedAt = new Date().toISOString();
  next.images = list.filter(x => x !== target);
  await putJsonFile(env, manPath, next, `update image manifest ${cleanMatch}`, sha);
  return json({ok:true, matchKey:cleanMatch, images:next.images});
}
async function readImage(request, env){
  const miss = assertRepoEnv(env);
  if(miss) return json({ok:false, message:miss}, 500);
  const url = new URL(request.url);
  const path = cleanSlash(url.searchParams.get('path') || '');
  const root = imageRoot(env);
  if(!path || !path.startsWith(`${root}/`)) return json({ok:false, message:'Invalid image path'}, 400);
  const apiUrl = `${githubApiBase(env)}/contents/${encodePath(path)}?ref=${encodeURIComponent(ghBranch(env))}`;
  const res = await fetch(apiUrl, {headers: githubHeaders(env, 'application/vnd.github.raw+json')});
  if(res.status === 404) return text('Not found', 404);
  if(!res.ok) return text(`GitHub image read failed: ${res.status}`, 502);
  const headers = new Headers(CORS_HEADERS);
  headers.set('Content-Type', extContentType(path));
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  headers.set('Pragma', 'no-cache');

  const contentType = res.headers.get('Content-Type') || '';
  if(contentType.includes('application/json')){
    const meta = await res.json();
    const binary = atob(String(meta.content || '').replace(/\s+/g, ''));
    const bytes = new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++) bytes[i] = binary.charCodeAt(i);
    return new Response(bytes, {status:200, headers});
  }
  return new Response(res.body, {status:200, headers});
}
async function handle(request, env){
  if(request.method === 'OPTIONS') return new Response(null, {status:204, headers:CORS_HEADERS});
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if(path === '/' || path === '/api/health'){
    return json({ok:true, service:'worldcup-storage-worker', branch:ghBranch(env), imageRoot:imageRoot(env)});
  }
  if(path === '/api/image' && request.method === 'GET') return readImage(request, env);

  const matchList = path.match(/^\/api\/matches\/([^/]+)\/images$/);
  if(matchList && request.method === 'GET') return listImages(request, env, decodeURIComponent(matchList[1]));
  if(matchList && request.method === 'POST') return uploadImages(request, env, decodeURIComponent(matchList[1]));

  const imageDelete = path.match(/^\/api\/matches\/([^/]+)\/images\/([^/]+)$/);
  if(imageDelete && request.method === 'DELETE') return deleteImage(request, env, decodeURIComponent(imageDelete[1]), decodeURIComponent(imageDelete[2]));

  return json({ok:false, message:'Not found'}, 404);
}

export default {
  async fetch(request, env){
    try{
      return await handle(request, env);
    }catch(err){
      return json({ok:false, message:String(err && err.message ? err.message : err)}, 500);
    }
  }
};
