import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const deviceDirectory = new URL('../vendor/device/', import.meta.url);
const pin = JSON.parse(readFileSync(new URL('compiler-pin.json', deviceDirectory), 'utf8'));
if (createHash('sha256').update(readFileSync(new URL('compiler.tgz', deviceDirectory))).digest('hex') !== pin.sha256) {
  throw Error('Device compiler hash mismatch.');
}
console.log('Verified device compiler export: ' + pin.commit);
const lunaDirectory = new URL('../vendor/luna/', import.meta.url);
const luna = JSON.parse(readFileSync(new URL('manifest.json', lunaDirectory), 'utf8'));
if (createHash('sha256').update(readFileSync(new URL(luna.file, lunaDirectory))).digest('hex') !== luna.sha256) {
  throw Error('Luna pack hash mismatch.');
}
console.log('Verified Luna publication pack: ' + luna.version);
const review = JSON.parse(readFileSync(new URL('draft-review/manifest.json', lunaDirectory), 'utf8'));
if (createHash('sha256').update(readFileSync(new URL('luna-work-draft.aipetframes', lunaDirectory))).digest('hex') !== review.packSha256 ||
  review.baseSha256 !== luna.sha256 || review.canonicalFramesObserved !== 150 ||
  review.foundationComposites !== 175 || !/^[a-f0-9]{40}$/.test(review.sourceCommit)) throw Error('Luna draft evidence mismatch.');
console.log('Verified draft Luna acting: all 150 generated frames observed in C/WASM.');
