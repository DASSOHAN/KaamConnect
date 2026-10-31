import assert from 'node:assert/strict';
import { getAudioDurationSeconds } from '../media/audio-duration.js';

const webmWithDuration = (seconds, scaleNs = 1_000_000) => {
  const scale = Buffer.from([0x2a, 0xd7, 0xb1, 0x83, (scaleNs >> 16) & 0xff, (scaleNs >> 8) & 0xff, scaleNs & 0xff]);
  const durationValue = Buffer.alloc(8);
  durationValue.writeDoubleBE(seconds * 1_000_000_000 / scaleNs);
  const duration = Buffer.concat([Buffer.from([0x44, 0x89, 0x88]), durationValue]);
  const info = Buffer.concat([Buffer.from([0x15, 0x49, 0xa9, 0x66, 0x92]), scale, duration]);
  return Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x80, 0x18, 0x53, 0x80, 0x67, 0xff]), info]);
};

const vint = (value) => value < 127 ? Buffer.from([0x80 | value]) : Buffer.from([0x40 | (value >> 8), value & 0xff]);
const element = (id, payload) => Buffer.concat([Buffer.from(id, 'hex'), vint(payload.length), payload]);
const webmWithOpusBlocks = (seconds) => {
  const timeScale = element('2ad7b1', Buffer.from([0x0f, 0x42, 0x40]));
  const info = element('1549a966', timeScale);
  const track = element('ae', Buffer.concat([element('d7', Buffer.from([1])), element('86', Buffer.from('A_OPUS'))]));
  const tracks = element('1654ae6b', track);
  const blocks = [element('e7', Buffer.from([0]))];
  for (let index = 0; index < seconds * 50; index += 1) {
    const timestamp = Buffer.alloc(2); timestamp.writeInt16BE(index * 20);
    blocks.push(element('a3', Buffer.concat([Buffer.from([0x81]), timestamp, Buffer.from([0, 0xf8])] )));
  }
  const cluster = element('1f43b675', Buffer.concat(blocks));
  const segment = element('18538067', Buffer.concat([info, tracks, cluster]));
  return Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x80]), segment]);
};

for (const seconds of [5, 13, 29, 30]) {
  const decoded = getAudioDurationSeconds(webmWithDuration(seconds), 'audio/webm;codecs=opus');
  assert.ok(Math.abs(decoded - seconds) < 0.001, `${seconds}s WebM decoded as ${decoded}`);
  assert.ok(decoded <= 30, `${seconds}s should be accepted`);
}
assert.ok(getAudioDurationSeconds(webmWithDuration(30.1), 'audio/webm') > 30, 'over-limit WebM must remain over limit');
assert.ok(Math.abs(getAudioDurationSeconds(webmWithDuration(13, 2_000_000), 'audio/webm') - 13) < 0.001, 'non-default WebM timecode scale');
assert.ok(Math.abs(getAudioDurationSeconds(webmWithOpusBlocks(4), 'audio/webm;codecs=opus') - 4) < 0.001, 'MediaRecorder-style WebM duration fallback from Opus block timestamps');
assert.ok(Math.abs(getAudioDurationSeconds(webmWithOpusBlocks(0.5), 'audio/webm;codecs=opus') - 0.5) < 0.001, 'sub-second WebM remains measurable and can be rejected by the 1-second rule');

const mp4V0 = (seconds) => {
  const buffer = Buffer.alloc(32);
  buffer.writeUInt32BE(32, 0); buffer.write('mvhd', 4); buffer.writeUInt32BE(1000, 20); buffer.writeUInt32BE(seconds * 1000, 24);
  return buffer;
};
const mp4V1 = (seconds) => {
  const buffer = Buffer.alloc(40);
  buffer.writeUInt32BE(40, 0); buffer.write('mvhd', 4); buffer[8] = 1; buffer.writeUInt32BE(1000, 28); buffer.writeBigUInt64BE(BigInt(seconds * 1000), 32);
  return buffer;
};
for (const seconds of [5, 13, 29, 30]) {
  assert.equal(getAudioDurationSeconds(mp4V0(seconds), 'audio/mp4'), seconds, `MP4 v0 ${seconds}s`);
  assert.equal(getAudioDurationSeconds(mp4V1(seconds), 'audio/mp4'), seconds, `MP4 v1 ${seconds}s`);
}
assert.equal(getAudioDurationSeconds(Buffer.from('bad'), 'audio/webm'), null, 'invalid WebM has no trusted duration');
assert.equal(getAudioDurationSeconds(Buffer.alloc(32), 'audio/mp4'), null, 'MP4 without mvhd has no trusted duration');

console.log('PASS: voice duration parser handles 5, 13, 29, 30, and over-30 second WebM/MP4 files.');
