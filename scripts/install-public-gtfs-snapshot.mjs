#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const RELEASE_URL = 'https://github.com/sandipmfiles-source/yatrabus-india/releases/download/gtfs-latest/yatribus-gtfs-snapshot.tar.gz';
const MAX_COMPRESSED = 100 * 1024 * 1024;
const MAX_EXPANDED = 500 * 1024 * 1024;
const destination = path.resolve(process.env.GTFS_DATA_DIR || 'artifacts/gtfs');

async function download(url, target) {
  const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(120000), headers: { 'user-agent': 'YatraBus-India-GTFS-Snapshot-Installer/1.0' } });
  if (!response.ok) throw new Error('Snapshot download failed with HTTP ' + response.status);
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > MAX_COMPRESSED) throw new Error('Compressed snapshot exceeds 100 MB limit');
  if (!response.body) throw new Error('Snapshot response has no body');
  const chunks = [];
  let total = 0;
  for await (const chunk of response.body) {
    const bytes = Buffer.from(chunk);
    total += bytes.length;
    if (total > MAX_COMPRESSED) throw new Error('Compressed snapshot exceeds 100 MB limit');
    chunks.push(bytes);
  }
  const buffer = Buffer.concat(chunks);
  await writeFile(target, buffer, { flag: 'wx' });
  return buffer;
}

async function main() {
  const work = await mkdtemp(path.join(tmpdir(), 'yatribus-gtfs-install-'));
  const archive = path.join(work, 'snapshot.tar.gz');
  const extracted = path.join(work, 'extracted');
  const backup = destination + '.previous';
  let movedOld = false;
  try {
    const bytes = await download(RELEASE_URL, archive);
    const { stdout: listing } = await execFileAsync('tar', ['-tzf', archive], { timeout: 60000, maxBuffer: 4 * 1024 * 1024 });
    const names = listing.split('\n').filter(Boolean);
    if (!names.length || names.length > 105) throw new Error('Unexpected snapshot archive entry count');
    for (const entry of names) {
      const clean = entry.replace(/^\.\//, '');
      if (clean === '') continue;
      if (!/^(?:[a-z0-9][a-z0-9_-]{0,79}\.json|import-report\.json)$/i.test(clean)) {
        throw new Error('Rejected unexpected archive path: ' + entry);
      }
    }
    const { stdout: verbose } = await execFileAsync('tar', ['-tvzf', archive], { timeout: 60000, maxBuffer: 4 * 1024 * 1024 });
    let expandedBytes = 0;
    for (const line of verbose.split('\n').filter(Boolean)) {
      if (!['-', 'd'].includes(line[0])) throw new Error('Snapshot archive contains a link or special file');
      const match = line.match(/^[^\s]+\s+\S+\s+(\d+)\s/);
      if (match) expandedBytes += Number(match[1]);
    }
    if (expandedBytes > MAX_EXPANDED) throw new Error('Expanded snapshot exceeds 500 MB limit');
    await mkdir(extracted, { recursive: true });
    await execFileAsync('tar', ['--extract', '--gzip', '--file', archive, '--directory', extracted, '--no-same-owner', '--no-same-permissions'], { timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
    const report = JSON.parse(await readFile(path.join(extracted, 'import-report.json'), 'utf8'));
    if (!Array.isArray(report.results) || report.results.length === 0 || report.results.some(row => row.status !== 'imported')) {
      throw new Error('Snapshot import report is missing or contains failed feeds');
    }
    const reportedFiles = new Set(report.results.map(row => row.output));
    for (const filename of await readdir(extracted)) {
      if (filename === 'import-report.json') continue;
      if (!reportedFiles.has(filename) || !/^[a-z0-9][a-z0-9_-]{0,79}\.json$/i.test(filename)) throw new Error('Snapshot contains an unreported feed file');
      const raw = await readFile(path.join(extracted, filename));
      const feed = JSON.parse(raw.toString('utf8'));
      if (feed.schemaVersion !== 1 || !feed.feed?.id || !Array.isArray(feed.stopTimes) || !Array.isArray(feed.calendar)) {
        throw new Error('Invalid normalized feed snapshot: ' + filename);
      }
      const digest = createHash('sha256').update(raw).digest('hex');
      // The import report carries the checksum of the original GTFS ZIP, not the normalized JSON.
      if (!feed.feed.sha256 || !/^[a-f0-9]{64}$/i.test(feed.feed.sha256)) throw new Error('Missing source checksum in ' + filename);
    }
    await rm(backup, { recursive: true, force: true });
    try { await stat(destination); await rename(destination, backup); movedOld = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    try {
      await mkdir(path.dirname(destination), { recursive: true });
      await rename(extracted, destination);
    } catch (error) {
      if (movedOld) await rename(backup, destination);
      throw error;
    }
    await rm(backup, { recursive: true, force: true });
    console.log('Installed ' + report.results.length + ' validated GTFS feed snapshots into ' + destination);
    console.log('Archive SHA-256: ' + createHash('sha256').update(bytes).digest('hex'));
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
main().catch(error => { console.error('GTFS snapshot install failed:', error.message || error); process.exit(1); });
