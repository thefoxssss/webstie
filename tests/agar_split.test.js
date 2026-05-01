require('./mock_setup.js');
const assert = require('assert');
const {
  AgarRoom,
  AgarState,
  AGAR_MAX_CELLS,
  AGAR_SPLIT_MIN_RADIUS,
  AGAR_MAP_WIDTH,
  AGAR_MAP_HEIGHT,
  AGAR_MERGE_COOLDOWN_MS
} = require('../server.js');

// Mock MapSchema since our mock returns a class extending Map
const MapSchema = Map;

function setupRoom() {
  const room = new AgarRoom();
  // Mock onCreate enough to have a state
  const state = new AgarState();
  state.players = new MapSchema();
  state.foods = new MapSchema();
  state.cells = new MapSchema();
  room.setState(state);
  room.cellCounter = 0;
  return room;
}

function testSplitSuccess() {
  console.log('Testing split success...');
  const room = setupRoom();
  const playerId = 'player1';
  const now = Date.now();

  // Create a cell large enough to split
  const initialRadius = 30;
  room.createCell(playerId, 100, 100, initialRadius, 0, 0, now);

  const input = { targetX: 200, targetY: 100 };
  room.trySplitPlayer(playerId, input, now);

  const cells = room.getPlayerCells(playerId);
  assert.strictEqual(cells.length, 2, 'Should have 2 cells after split');

  const originalCell = cells.find(c => c.id === 'cell_0');
  const newCell = cells.find(c => c.id === 'cell_1');

  const expectedRadius = initialRadius / Math.sqrt(2);
  assert.ok(Math.abs(originalCell.radius - expectedRadius) < 0.001, 'Original cell radius should be reduced');
  assert.ok(Math.abs(newCell.radius - expectedRadius) < 0.001, 'New cell should have reduced radius');

  assert.strictEqual(originalCell.mergeAt, now + AGAR_MERGE_COOLDOWN_MS, 'Original cell mergeAt should be updated');
  assert.strictEqual(newCell.mergeAt, now + AGAR_MERGE_COOLDOWN_MS, 'New cell mergeAt should be set');

  // Check direction (towards 200, 100 from 100, 100 is +X)
  assert.ok(newCell.x > originalCell.x, 'New cell should be launched towards target');
  assert.strictEqual(newCell.y, originalCell.y, 'New cell should have same Y if target is on same horizontal line');
}

function testSplitFailureTooSmall() {
  console.log('Testing split failure when too small...');
  const room = setupRoom();
  const playerId = 'player1';
  const now = Date.now();

  // Radius below AGAR_SPLIT_MIN_RADIUS (24)
  room.createCell(playerId, 100, 100, 20, 0, 0, now);

  room.trySplitPlayer(playerId, { targetX: 200, targetY: 100 }, now);

  const cells = room.getPlayerCells(playerId);
  assert.strictEqual(cells.length, 1, 'Should NOT split when too small');
}

function testSplitFailureMaxCells() {
  console.log('Testing split failure when at max cells...');
  const room = setupRoom();
  const playerId = 'player1';
  const now = Date.now();

  // Fill up to max cells
  for (let i = 0; i < AGAR_MAX_CELLS; i++) {
    room.createCell(playerId, 100 + i, 100, 30, 0, 0, now);
  }

  assert.strictEqual(room.getPlayerCells(playerId).length, AGAR_MAX_CELLS);

  room.trySplitPlayer(playerId, { targetX: 200, targetY: 100 }, now);

  assert.strictEqual(room.getPlayerCells(playerId).length, AGAR_MAX_CELLS, 'Should NOT exceed max cells');
}

function testSplitBoundaryClamping() {
  console.log('Testing split boundary clamping...');
  const room = setupRoom();
  const playerId = 'player1';
  const now = Date.now();

  // Near right boundary, split towards it
  room.createCell(playerId, AGAR_MAP_WIDTH - 5, 100, 40, 0, 0, now);

  room.trySplitPlayer(playerId, { targetX: AGAR_MAP_WIDTH + 100, targetY: 100 }, now);

  const cells = room.getPlayerCells(playerId);
  assert.strictEqual(cells.length, 2);
  const newCell = cells.find(c => c.id === 'cell_1');
  assert.strictEqual(newCell.x, AGAR_MAP_WIDTH, 'New cell should be clamped to map boundary');
}

function testPartialSplitToMax() {
  console.log('Testing partial split up to max cells...');
  const room = setupRoom();
  const playerId = 'player1';
  const now = Date.now();

  // Start with AGAR_MAX_CELLS - 1
  for (let i = 0; i < AGAR_MAX_CELLS - 1; i++) {
    room.createCell(playerId, 100, 100, 30, 0, 0, now);
  }

  room.trySplitPlayer(playerId, { targetX: 200, targetY: 100 }, now);

  const cells = room.getPlayerCells(playerId);
  assert.strictEqual(cells.length, AGAR_MAX_CELLS, 'Should split only once to reach max cells');
}

try {
  testSplitSuccess();
  testSplitFailureTooSmall();
  testSplitFailureMaxCells();
  testSplitBoundaryClamping();
  testPartialSplitToMax();
  console.log('All tests passed!');
} catch (error) {
  console.error('Test failed!');
  console.error(error);
  process.exit(1);
}
