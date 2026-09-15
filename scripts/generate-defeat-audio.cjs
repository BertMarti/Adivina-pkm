const fs = require('node:fs');

const sampleRate = 22_050;
const duration = 0.85;
const samples = Math.floor(sampleRate * duration);
const pcm = Buffer.alloc(samples * 2);
const notes = [196, 155.56, 130.81];
for (let index = 0; index < samples; index += 1) {
  const time = index / sampleRate;
  const note = notes[Math.min(notes.length - 1, Math.floor(time / 0.28))];
  const local = time % 0.28;
  const envelope = Math.max(0, 1 - local / 0.28) * Math.min(1, local / 0.018);
  const value = Math.sin(2 * Math.PI * note * time) * envelope * 0.22;
  pcm.writeInt16LE(Math.round(value * 32767), index * 2);
}
const header = Buffer.alloc(44);
header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVE', 8);
header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22); header.writeUInt32LE(sampleRate, 24); header.writeUInt32LE(sampleRate * 2, 28);
header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
fs.writeFileSync('assets/defeat-reference.wav', Buffer.concat([header, pcm]));
console.log('assets/defeat-reference.wav generado');
