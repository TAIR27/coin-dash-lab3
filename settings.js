// Keep tuning separate from game behaviour so features can be developed independently.
window.COIN_DASH = {
  width: 800,
  height: 500,
  roundSeconds: 60,
  playerSpeed: 240,
  droneSpeed: 105,
  droneSpeedJitter: 20,
  // Enemies per map by distance from the centre map (0 = centre, 1 = edge, 2 = corner).
  enemiesByDistance: [
    { drones: 3, chasers: 0, dashers: 0 },
    { drones: 3, chasers: 1, dashers: 0 },
    { drones: 2, chasers: 2, dashers: 1 }
  ],
  chaserSpeed: 85,
  dasher: { driftSpeed: 40, dashSpeed: 380, intervalMs: 2200, windupMs: 600, dashMs: 450 },
  mapCols: 3,
  mapRows: 3,
  coinsPerMap: 5,
  mapEntryGraceMs: 800,
  colors: {
    background: 0x101c31, player: 0x71e8ce, coin: 0xffd166,
    drone: 0xff657a, chaser: 0xff9f43, dasher: 0xc77dff
  }
};
