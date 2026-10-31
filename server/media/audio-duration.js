const EBML_HEADER = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
const WEBM_TIME_SCALE_ID = Buffer.from([0x2a, 0xd7, 0xb1]);
const WEBM_DURATION_ID = Buffer.from([0x44, 0x89]);

function* readElements(buffer, start, end) {
  let offset = start;
  while (offset < end) {
    const id = readVint(buffer, offset);
    if (!id) return;
    const size = readVint(buffer, offset + id.length, true);
    if (!size) return;
    const valueOffset = offset + id.length + size.length;
    const valueEnd = size.unknownSize ? end : valueOffset + size.value;
    if (valueEnd > end) return;
    yield { idHex: buffer.subarray(offset, offset + id.length).toString('hex'), valueOffset, valueEnd, unknownSize: size.unknownSize };
    if (size.unknownSize) return;
    offset = valueEnd;
  }
}

function readUnsigned(buffer, start, end) {
  const size = end - start;
  return size > 0 && size <= 6 ? buffer.readUIntBE(start, size) : null;
}

function opusPacketDurationSeconds(packet) {
  if (!packet.length) return null;
  const toc = packet[0], config = toc >> 3, code = toc & 3;
  const frameSeconds = config >= 16 ? [0.0025, 0.005, 0.01, 0.02][config & 3]
    : config >= 12 ? [0.01, 0.02][config & 1]
      : [0.01, 0.02, 0.04, 0.06][config & 3];
  const count = code === 0 ? 1 : code === 1 || code === 2 ? 2 : packet.length > 1 ? packet[1] & 0x3f : 0;
  const total = frameSeconds * count;
  return count > 0 && total <= 0.12 ? total : null;
}

function blockPacketSizes(buffer, start, end, flags) {
  const lace = flags & 0x06;
  if (!lace) return [{ start, end }];
  if (start >= end) return null;
  const count = buffer[start++] + 1;
  if (count < 2) return null;
  const sizes = [];
  if (lace === 0x02) {
    let total = 0;
    for (let frame = 0; frame < count - 1; frame += 1) {
      let size = 0, byte;
      do { if (start >= end) return null; byte = buffer[start++]; size += byte; } while (byte === 255);
      sizes.push(size); total += size;
    }
    sizes.push(end - start - total);
  } else if (lace === 0x04) {
    const remaining = end - start;
    if (remaining % count) return null;
    for (let frame = 0; frame < count; frame += 1) sizes.push(remaining / count);
  } else {
    const first = readVint(buffer, start, true);
    if (!first) return null;
    start += first.length; sizes.push(first.value);
    let previous = first.value, total = previous;
    for (let frame = 1; frame < count - 1; frame += 1) {
      const delta = readVint(buffer, start, true);
      if (!delta) return null;
      start += delta.length;
      const bias = 2 ** (7 * delta.length - 1) - 1;
      previous += delta.value - bias;
      if (previous < 0) return null;
      sizes.push(previous); total += previous;
    }
    sizes.push(end - start - total);
  }
  if (sizes.some((size) => size < 0) || sizes.reduce((sum, size) => sum + size, 0) !== end - start) return null;
  const ranges = []; let cursor = start;
  for (const size of sizes) { ranges.push({ start: cursor, end: cursor + size }); cursor += size; }
  return ranges;
}

function parseBlock(buffer, start, end) {
  const track = readVint(buffer, start, true);
  if (!track || start + track.length + 3 > end) return null;
  const timestampOffset = start + track.length;
  const relativeTimestamp = buffer.readInt16BE(timestampOffset);
  const flags = buffer[timestampOffset + 2];
  const packetStart = timestampOffset + 3;
  const packets = blockPacketSizes(buffer, packetStart, end, flags);
  if (!packets) return null;
  const durations = packets.map(({ start: packetStart, end: packetEnd }) => opusPacketDurationSeconds(buffer.subarray(packetStart, packetEnd)));
  if (durations.some((duration) => !Number.isFinite(duration))) return null;
  return { trackNumber: track.value, relativeTimestamp, packetDuration: durations.reduce((sum, duration) => sum + duration, 0) };
}

function readVint(buffer, offset, forSize = false) {
  if (offset >= buffer.length) return null;
  const first = buffer[offset];
  let length = 1;
  let marker = 0x80;
  while (length <= 8 && !(first & marker)) { marker >>= 1; length += 1; }
  if (length > 8 || offset + length > buffer.length) return null;
  let value = forSize ? first & (marker - 1) : first;
  for (let index = 1; index < length; index += 1) value = value * 256 + buffer[offset + index];
  const maxValue = 2 ** (7 * length) - 1;
  return { length, value, unknownSize: forSize && value === maxValue };
}

function webmDurationSeconds(buffer) {
  if (buffer.length < EBML_HEADER.length || !buffer.subarray(0, 4).equals(EBML_HEADER)) return null;
  const headerSize = readVint(buffer, 4, true);
  if (!headerSize) return null;
  let offset = 4 + headerSize.length + headerSize.value;
  let timecodeScaleNs = 1_000_000;
  let durationUnits = null;
  const opusTracks = new Set();
  const clusters = [];
  while (offset < buffer.length) {
    const id = readVint(buffer, offset);
    if (!id) break;
    const size = readVint(buffer, offset + id.length, true);
    if (!size) break;
    const valueOffset = offset + id.length + size.length;
    const valueEnd = size.unknownSize ? buffer.length : valueOffset + size.value;
    if (valueEnd > buffer.length) break;
    const idHex = buffer.subarray(offset, offset + id.length).toString('hex');
    if (idHex === '18538067') {
      for (const segmentElement of readElements(buffer, valueOffset, valueEnd)) {
        if (segmentElement.idHex === '1549a966') {
          for (const infoElement of readElements(buffer, segmentElement.valueOffset, segmentElement.valueEnd)) {
            if (infoElement.idHex === WEBM_TIME_SCALE_ID.toString('hex')) timecodeScaleNs = readUnsigned(buffer, infoElement.valueOffset, infoElement.valueEnd) ?? timecodeScaleNs;
            if (infoElement.idHex === WEBM_DURATION_ID.toString('hex')) {
              const size = infoElement.valueEnd - infoElement.valueOffset;
              if (size === 4) durationUnits = buffer.readFloatBE(infoElement.valueOffset);
              if (size === 8) durationUnits = buffer.readDoubleBE(infoElement.valueOffset);
            }
          }
        }
        if (segmentElement.idHex === '1654ae6b') {
          for (const entry of readElements(buffer, segmentElement.valueOffset, segmentElement.valueEnd)) {
            if (entry.idHex !== 'ae') continue;
            let trackNumber = null, codec = '';
            for (const field of readElements(buffer, entry.valueOffset, entry.valueEnd)) {
              if (field.idHex === 'd7') trackNumber = readUnsigned(buffer, field.valueOffset, field.valueEnd);
              if (field.idHex === '86') codec = buffer.subarray(field.valueOffset, field.valueEnd).toString('ascii');
            }
            if (codec === 'A_OPUS' && trackNumber !== null) opusTracks.add(trackNumber);
          }
        }
        if (segmentElement.idHex === '1f43b675') clusters.push(segmentElement);
      }
    }
    if (size.unknownSize) break;
    offset = valueEnd;
  }
  if (!Number.isFinite(timecodeScaleNs) || timecodeScaleNs <= 0) return null;
  if (Number.isFinite(durationUnits)) {
    const seconds = durationUnits * timecodeScaleNs / 1_000_000_000;
    if (Number.isFinite(seconds) && seconds > 0) return seconds;
  }
  if (!opusTracks.size) return null;
  let latestEnd = 0;
  for (const cluster of clusters) {
    let clusterTimecode = 0;
    const blocks = [];
    for (const element of readElements(buffer, cluster.valueOffset, cluster.valueEnd)) {
      if (element.idHex === 'e7') clusterTimecode = readUnsigned(buffer, element.valueOffset, element.valueEnd) ?? clusterTimecode;
      if (element.idHex === 'a3') blocks.push({ block: parseBlock(buffer, element.valueOffset, element.valueEnd), duration: null });
      if (element.idHex === 'a0') {
        let block = null, duration = null;
        for (const child of readElements(buffer, element.valueOffset, element.valueEnd)) {
          if (child.idHex === 'a1') block = parseBlock(buffer, child.valueOffset, child.valueEnd);
          if (child.idHex === '9b') duration = readUnsigned(buffer, child.valueOffset, child.valueEnd);
        }
        blocks.push({ block, duration });
      }
    }
    for (const { block, duration } of blocks) {
      if (!block || !opusTracks.has(block.trackNumber)) continue;
      const tickEnd = clusterTimecode + block.relativeTimestamp;
      const blockSeconds = duration === null ? block.packetDuration : duration * timecodeScaleNs / 1_000_000_000;
      latestEnd = Math.max(latestEnd, (tickEnd * timecodeScaleNs / 1_000_000_000) + blockSeconds);
    }
  }
  return latestEnd > 0 ? latestEnd : null;
}

function mp4DurationSeconds(buffer) {
  for (let typeOffset = 4; typeOffset + 24 <= buffer.length; typeOffset += 1) {
    if (buffer.subarray(typeOffset, typeOffset + 4).toString() !== 'mvhd') continue;
    const version = buffer[typeOffset + 4];
    if (version === 0 && typeOffset + 24 <= buffer.length) {
      const timescale = buffer.readUInt32BE(typeOffset + 16);
      const duration = buffer.readUInt32BE(typeOffset + 20);
      if (timescale > 0) return duration / timescale;
    }
    if (version === 1 && typeOffset + 36 <= buffer.length) {
      const timescale = buffer.readUInt32BE(typeOffset + 24);
      const duration = Number(buffer.readBigUInt64BE(typeOffset + 28));
      if (timescale > 0 && Number.isFinite(duration)) return duration / timescale;
    }
  }
  return null;
}

export function getAudioDurationSeconds(buffer, mimeType) {
  const baseType = String(mimeType || '').split(';', 1)[0].trim().toLowerCase();
  if (baseType === 'audio/webm') return webmDurationSeconds(buffer);
  if (baseType === 'audio/mp4') return mp4DurationSeconds(buffer);
  return null;
}
