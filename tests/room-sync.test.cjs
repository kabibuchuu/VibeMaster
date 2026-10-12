const test = require('node:test');
const assert = require('node:assert/strict');

function estimateRoomPositionMs(room, nowMs) {
  const anchor = Math.max(0, room.position);
  if (room.status !== 'playing') return anchor;
  const updatedAt = room.playbackUpdatedAt ?? nowMs;
  return anchor + Math.max(0, nowMs - updatedAt);
}

test('paused rooms keep the anchored position', () => {
  assert.equal(estimateRoomPositionMs({ status: 'paused', position: 12000, playbackUpdatedAt: 1000 }, 9000), 12000);
});

test('playing rooms advance from their latest server anchor', () => {
  assert.equal(estimateRoomPositionMs({ status: 'playing', position: 12000, playbackUpdatedAt: 1000 }, 9000), 20000);
});

test('room clock never subtracts position while client clock is earlier than anchor', () => {
  assert.equal(estimateRoomPositionMs({ status: 'playing', position: 12000, playbackUpdatedAt: 9000 }, 1000), 12000);
});

test('missing anchor falls back to the caller clock without jumping', () => {
  assert.equal(estimateRoomPositionMs({ status: 'playing', position: 12000 }, 7000), 12000);
});

test('negative positions are normalized to zero', () => {
  assert.equal(estimateRoomPositionMs({ status: 'paused', position: -500, playbackUpdatedAt: 1000 }, 5000), 0);
});
