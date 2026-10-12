const test = require('node:test');
const assert = require('node:assert/strict');

// Mirrors estimateRoomPositionSeconds in src/lib/roomRepository.ts.
function estimateRoomPositionSeconds(room, nowMs) {
  const anchor = Math.max(0, room.position);
  if (room.status !== 'playing') return anchor;
  const updatedAt = room.playbackUpdatedAt ?? nowMs;
  return anchor + Math.max(0, (nowMs - updatedAt) / 1000);
}

test('paused rooms keep the anchored position in seconds', () => {
  assert.equal(estimateRoomPositionSeconds({ status: 'paused', position: 12, playbackUpdatedAt: 1000 }, 9000), 12);
});

test('playing rooms advance from their last timestamp anchor', () => {
  assert.equal(estimateRoomPositionSeconds({ status: 'playing', position: 12, playbackUpdatedAt: 1000 }, 9000), 20);
});

test('the clock never subtracts from the anchored playhead', () => {
  assert.equal(estimateRoomPositionSeconds({ status: 'playing', position: 12, playbackUpdatedAt: 9000 }, 1000), 12);
});

test('a missing timestamp leaves the playhead unchanged for that instant', () => {
  assert.equal(estimateRoomPositionSeconds({ status: 'playing', position: 12 }, 7000), 12);
});

test('negative positions are normalized to zero', () => {
  assert.equal(estimateRoomPositionSeconds({ status: 'paused', position: -0.5, playbackUpdatedAt: 1000 }, 5000), 0);
});

test('fractional seconds are preserved for small seek corrections', () => {
  assert.equal(estimateRoomPositionSeconds({ status: 'playing', position: 30.25, playbackUpdatedAt: 1000 }, 1750), 31);
});
