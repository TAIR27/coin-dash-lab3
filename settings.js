// Keep tuning separate from game behaviour so features can be developed independently.
window.COIN_DASH = {
  width: 800,
  height: 500,
  roundSeconds: 60,
  playerSpeed: 240,
  droneSpeed: 105,
  droneCount: 3,
  mapCols: 3,
  mapRows: 3,
  coinsPerMap: 5,
  mapEntryGraceMs: 800,
  // Obstacles per map (the centre map gets fewer), wall length/thickness in px, and the margin
  // kept free along every edge so crossing between maps never lands inside one.
  obstaclesPerMap: [3, 4],
  centreObstacles: 2,
  obstacleLength: [80, 170],
  obstacleThickness: [24, 44],
  obstacleEdgeMargin: 60,
  colors: { background: 0x101c31, player: 0x71e8ce, coin: 0xffd166, drone: 0xff657a, obstacle: 0x3b4d6b }
};
