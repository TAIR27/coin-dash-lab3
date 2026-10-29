/* global Phaser, COIN_DASH */
class CoinDash extends Phaser.Scene {
  constructor() { super('CoinDash'); }

  create() {
    const c = COIN_DASH;
    this.score = 0;
    this.finished = false;
    this.deadline = this.time.now + c.roundSeconds * 1000;
    // Remaining coin positions per map, keyed "col,row"; filled on the first visit.
    this.maps = {};
    this.mapCol = Math.floor(c.mapCols / 2);
    this.mapRow = Math.floor(c.mapRows / 2);
    this.physics.world.setBounds(0, 44, c.width, c.height - 44);
    this.background = this.add.grid(c.width / 2, c.height / 2, c.width, c.height, 40, 40,
      c.colors.background, 1, 0x24334b, 0.45);
    this.hud = this.add.text(18, 12, '', { font: '18px monospace', color: '#ffffff' });
    // Minimap in the bottom-right corner, one cell per map; enterMap() lights the current one.
    const cell = 14, gap = 4;
    this.minimap = [];
    for (let row = 0; row < c.mapRows; row++) {
      for (let col = 0; col < c.mapCols; col++) {
        const x = c.width - 12 - cell / 2 - (c.mapCols - 1 - col) * (cell + gap);
        const y = c.height - 12 - cell / 2 - (c.mapRows - 1 - row) * (cell + gap);
        this.minimap.push(this.add.rectangle(x, y, cell, cell)
          .setStrokeStyle(1, 0xffffff, 0.5).setDepth(10).setData({ col, row }));
      }
    }
    this.player = this.add.circle(c.width / 2, c.height / 2, 12, c.colors.player);
    this.physics.add.existing(this.player);
    this.coins = this.physics.add.group();
    this.drones = this.physics.add.group();
    this.physics.add.overlap(this.player, this.coins, (player, coin) => {
      if (this.finished) return;
      this.score++;
      const spots = this.currentMap().coins;
      spots.splice(spots.indexOf(coin.getData('spot')), 1);
      coin.destroy();
    });
    this.physics.add.overlap(this.player, this.drones, () => {
      if (this.time.now >= this.safeUntil) this.finish('A drone caught you!');
    });
    this.enterMap();
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R');
    this.input.keyboard.on('keydown-R', () => this.scene.restart());
  }

  currentMap() {
    const key = `${this.mapCol},${this.mapRow}`;
    if (!this.maps[key]) this.maps[key] = { coins: this.randomSpots(COIN_DASH.coinsPerMap, 60) };
    return this.maps[key];
  }

  // Random points inside the play area, at least minDistance away from the player.
  randomSpots(count, minDistance) {
    const c = COIN_DASH;
    const spots = [];
    while (spots.length < count) {
      const x = Phaser.Math.Between(25, c.width - 25);
      const y = Phaser.Math.Between(70, c.height - 25);
      if (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) >= minDistance) {
        spots.push({ x, y });
      }
    }
    return spots;
  }

  // Replace the previous map's coins and drones with the current map's.
  enterMap() {
    const c = COIN_DASH;
    this.coins.clear(true, true);
    this.drones.clear(true, true);
    const base = Phaser.Display.Color.IntegerToColor(c.colors.background);
    this.background.setFillStyle(Phaser.Display.Color.GetColor(
      base.red + this.mapCol * 10, base.green + this.mapRow * 10, base.blue));
    for (const square of this.minimap) {
      const here = square.getData('col') === this.mapCol && square.getData('row') === this.mapRow;
      square.setFillStyle(here ? c.colors.player : 0x24334b, here ? 1 : 0.6);
    }
    for (const spot of this.currentMap().coins) {
      const coin = this.add.circle(spot.x, spot.y, 9, c.colors.coin).setData('spot', spot);
      this.coins.add(coin);
      coin.body.setCircle(9);
    }
    // Drones spawn away from the entry point, and touching one is harmless for a moment.
    for (const spot of this.randomSpots(c.droneCount, 200)) {
      const drone = this.add.circle(spot.x, spot.y, 13, c.colors.drone);
      this.drones.add(drone);
      drone.body.setCollideWorldBounds(true).setBounce(1, 1);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      drone.body.setVelocity(Math.cos(angle) * c.droneSpeed, Math.sin(angle) * c.droneSpeed);
    }
    this.safeUntil = this.time.now + c.mapEntryGraceMs;
  }

  // Crossing an edge that has a neighbouring map moves the player there; outer edges are walls.
  checkEdges() {
    const c = COIN_DASH;
    const r = 12, top = 44;
    let { x, y } = this.player;
    let col = this.mapCol, row = this.mapRow;
    if (x < r && col > 0) { col--; x = c.width - r - 4; }
    else if (x > c.width - r && col < c.mapCols - 1) { col++; x = r + 4; }
    else if (y < top + r && row > 0) { row--; y = c.height - r - 4; }
    else if (y > c.height - r && row < c.mapRows - 1) { row++; y = top + r + 4; }
    x = Phaser.Math.Clamp(x, r, c.width - r);
    y = Phaser.Math.Clamp(y, top + r, c.height - r);
    if (x !== this.player.x || y !== this.player.y) this.player.body.reset(x, y);
    if (col !== this.mapCol || row !== this.mapRow) {
      this.mapCol = col;
      this.mapRow = row;
      this.enterMap();
    }
  }

  update() {
    if (this.finished) return;
    this.checkEdges();
    const dx = Number(this.cursors.right.isDown || this.keys.D.isDown)
      - Number(this.cursors.left.isDown || this.keys.A.isDown);
    const dy = Number(this.cursors.down.isDown || this.keys.S.isDown)
      - Number(this.cursors.up.isDown || this.keys.W.isDown);
    const direction = new Phaser.Math.Vector2(dx, dy).normalize().scale(COIN_DASH.playerSpeed);
    this.player.body.setVelocity(direction.x, direction.y);
    const seconds = Math.max(0, Math.ceil((this.deadline - this.time.now) / 1000));
    const map = `Map ${this.mapCol + 1},${this.mapRow + 1}`;
    this.hud.setText(`Coins: ${this.score}          ${map}          Time: ${seconds}s`);
    if (seconds === 0) this.finish('Time is up!');
  }

  finish(reason) {
    if (this.finished) return;
    this.finished = true;
    this.physics.pause();
    const c = COIN_DASH;
    this.add.rectangle(c.width / 2, c.height / 2, 460, 150, 0x0a1120, 0.95);
    this.add.text(c.width / 2, c.height / 2,
      `${reason}\n${this.score} coins collected\nPress R to try again`,
      { font: '24px monospace', color: '#ffffff', align: 'center', lineSpacing: 12 }
    ).setOrigin(0.5);
  }
}
window.coinDashGame = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: COIN_DASH.width,
  height: COIN_DASH.height,
  backgroundColor: COIN_DASH.colors.background,
  physics: { default: 'arcade', arcade: { debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
  scene: CoinDash
});
