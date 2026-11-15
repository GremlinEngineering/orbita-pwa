import {getJSON, remember, sameOrigin} from './site.js';

const world = new URL('/game-worlds/orbita/', location.origin);
const root = new URL('./', location.href);
const cacheName = root.pathname + ':art';
const alias = path => sameOrigin(path, world, world.pathname).href;
const mediaPath = /^(?:(?:equipment|portraits|rooms|station-views|atlas)\/)?[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*\.(?:png|webp|jpe?g|avif|svg|gif)$/i;
const group = path => path.includes('/') ? path.split('/')[0] : 'схемы';

function validPath(path) {
    return typeof path === 'string' && mediaPath.test(path) && !path.split('/').some(part => part === '..' || part === '.');
}
function version(data) {
    if (data?.schema !== 1 || !Array.isArray(data.files) || !data.files.length)
        throw new Error('Индекс артов недоступен');
    const unique = new Map();
    for (const row of data.files) {
        if (!validPath(row.path) || !Number.isSafeInteger(row.bytes) || row.bytes < 1 ||
            !/^[0-9a-f]{64}$/.test(row.sha256) || unique.has(row.path))
            throw new Error('Некорректный индекс артов');
        unique.set(row.path, row);
    }
    return [...unique.values()];
}

export async function artIndex(refresh) {
    const [saved, seed] = await Promise.all([remember('art-index'), getJSON('./published-art.json')]);
    const previous = Array.isArray(saved) ? {versioned: true, rows: saved} : saved;
    if (refresh) {
        let response;
        try { response = await fetch(new URL('art-index.json', world), {cache: 'no-store', headers: {'X-Orbita-Art-Refresh': '1'}}); }
        catch (error) { if (!previous) throw error; }
        if (response?.ok) {
            const rows = version(await response.json());
            await remember('art-index', {versioned: true, rows});
            return rows;
        }
        if (response && response.status !== 404 && !previous) throw new Error(`Индекс артов (HTTP ${response.status})`);
    }
    if (previous && (!refresh || previous.versioned)) return previous.rows;
    const files = new Map(Object.entries(seed).filter(([path]) => validPath(path)).map(([path, bytes]) => [path, {path, bytes}]));
    for (const row of previous?.rows || []) files.set(row.path, row);
    if (refresh) {
        // Current public installations without the hash index already publish these lists.
        const documents = await Promise.all(['portraits/index.json', 'equipment.json', 'stations.json'].map(name =>
            getJSON(new URL(name, world)).catch(() => null)));
        for (const id of Array.isArray(documents[0]) ? documents[0] : []) {
            if (typeof id === 'string' && /^[a-z0-9_-]+$/i.test(id)) {
                const path = `portraits/${id}.webp`;
                if (!files.has(path)) files.set(path, {path});
            }
        }
        const visit = value => {
            if (typeof value === 'string') {
                const path = value.replace(/^\.\//, '');
                if (path.includes('/') && validPath(path) && !files.has(path)) files.set(path, {path});
            } else if (value && typeof value === 'object') Object.values(value).forEach(visit);
        };
        visit(documents[1]);
        visit(documents[2]);
        await remember('art-index', {versioned: false, rows: [...files.values()]});
    }
    return [...files.values()];
}

export function artGroups(entries) {
    return [...new Set(entries.map(({path}) => group(path)))].sort();
}
export function artGroup(entries, name) {
    return name ? entries.filter(({path}) => group(path) === name) : entries;
}
export const artURL = alias;

export async function savedArtCount() {
    return (await (await caches.open(cacheName)).keys()).length;
}
function changeSavedArt(operation) {
    return navigator.locks ? navigator.locks.request(cacheName,operation) : operation();
}
export function clearSavedArt() {
    return changeSavedArt(()=>caches.delete(cacheName));
}
export function saveArt(entries,signal,progress) {
    return changeSavedArt(()=>downloadArt(entries,signal,progress));
}

async function digest(blob) {
    const hash = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
async function downloadArt(entries, signal, progress) {
    const cache = await caches.open(cacheName);
    const summary = {done: 0, saved: 0, unchanged: 0, removed: [], errors: []};
    const update = async (row, request) => {
        const url = alias(row.path);
        const old = await cache.match(url);
        if (row.sha256 && old?.headers.get('X-Orbita-SHA256') === row.sha256) return 'unchanged';
        const headers = new Headers({'X-Orbita-Art-Refresh': '1'});
        const tag = old?.headers.get('ETag'), modified = old?.headers.get('Last-Modified');
        if (tag) headers.set('If-None-Match', tag);
        else if (modified) headers.set('If-Modified-Since', modified);
        const response = await fetch(url, {cache: 'no-store', headers, signal: request});
        if (response.status === 404 && !row.sha256 && !old) return 'removed';
        if (response.status === 304 && old) {
            if (row.sha256 && await digest(await old.blob()) !== row.sha256)
                throw new Error('Индекс и сервер отдают разные версии');
            return 'unchanged';
        }
        if (response.status !== 200 || !/^image\//i.test(response.headers.get('Content-Type') || ''))
            throw new Error(`Не удалось получить изображение (HTTP ${response.status})`);
        const body = await response.blob();
        if (!body.size || (row.sha256 && (body.size !== row.bytes || await digest(body) !== row.sha256)))
            throw new Error('Контрольная сумма изображения не совпала');
        const savedHeaders = new Headers();
        for (const key of ['Content-Type', 'ETag', 'Last-Modified']) {
            const value = response.headers.get(key);
            if (value) savedHeaders.set(key, value);
        }
        if (row.sha256) savedHeaders.set('X-Orbita-SHA256', row.sha256);
        if (signal.aborted) return 'unchanged';
        await cache.put(url, new Response(body, {headers: savedHeaders}));
        return 'saved';
    };
    async function retry(row) {
        for (let attempt = 0; attempt < 3; ++attempt) {
            if (signal.aborted) return 'unchanged';
            const controller = new AbortController();
            const abort = () => controller.abort();
            signal.addEventListener('abort', abort, {once: true});
            const timer = setTimeout(abort, 15000);
            try { return await update(row, controller.signal); }
            catch (error) {
                if (signal.aborted || error.name === 'QuotaExceededError' || attempt === 2) throw error;
            } finally {
                clearTimeout(timer);
                signal.removeEventListener('abort', abort);
            }
            await new Promise(resolve => setTimeout(resolve, 350 * (attempt + 1)));
        }
    }
    let next = 0, quotaError;
    await Promise.all(Array.from({length: Math.min(4, entries.length)}, async () => {
        while (!signal.aborted && !quotaError && next < entries.length) {
            const row = entries[next++];
            try {
                const result = await retry(row);
                if (!signal.aborted) {
                    if (result === 'removed') summary.removed.push(row.path);
                    else ++summary[result];
                }
            } catch (error) {
                if (!signal.aborted) {
                    summary.errors.push({path: row.path, reason: error.message});
                    if (error.name === 'QuotaExceededError') quotaError = error;
                }
            }
            if (!signal.aborted) progress({...summary, done: ++summary.done});
        }
    }));
    if(quotaError) throw quotaError;
    return summary;
}
