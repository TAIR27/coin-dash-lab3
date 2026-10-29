/* global Phaser, COIN_DASH */
// The best score lives in localStorage; storage may be unavailable, so failures fall back to 0.
const HIGH_SCORE_KEY = 'coinDash.highScore';
function loadHighScore() {
  try {
    const value = parseInt(window.localStorage.getItem(HIGH_SCORE_KEY), 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch (e) { return 0; }
}
function saveHighScore(value) {
  try { window.localStorage.setItem(HIGH_SCORE_KEY, String(value)); } catch (e) { /* ignore */ }
}

class CoinDash extends Phaser.Scene {
  constructor() { super('CoinDash'); }

  create() {
    const c = COIN_DASH;
    this.score = 0;
    this.highScore = loadHighScore();
    this.finished = false;
    this.paused = false;
    this.deadline = this.time.now + c.roundSeconds * 1000;
    // Obstacle layout and remaining coin positions per map, keyed "col,row"; filled on the first visit.
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
    this.obstacles = this.physics.add.staticGroup();
    this.physics.add.collider(this.player, this.obstacles);
    this.physics.add.collider(this.drones, this.obstacles);
    this.physics.add.overlap(this.player, this.coins, (player, coin) => {
      if (this.finished) return;
      this.score++;
      if (this.score > this.highScore) {
        this.highScore = this.score;
        saveHighScore(this.highScore);
      }
      const spots = this.currentMap().coins;
      spots.splice(spots.indexOf(coin.getData('spot')), 1);
      coin.destroy();
    });
    this.physics.add.overlap(this.player, this.drones, (player, enemy) => {
      if (this.time.now < this.safeUntil) return;
      this.finish(`A ${enemy.getData('kind')} caught you!`);
    });
    this.enterMap();
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R');
    this.input.keyboard.on('keydown-R', () => this.scene.restart());
    this.input.keyboard.on('keydown-P', () => this.togglePause());
  }

  togglePause() {
    if (this.finished) return;
    this.paused = !this.paused;
    if (this.paused) {
      this.pausedAt = this.time.now;
      this.physics.pause();
      const c = COIN_DASH;
      this.pauseText = this.add.text(c.width / 2, c.height / 2, 'PAUSED\nPress P to resume',
        { font: '32px monospace', color: '#ffffff', align: 'center', lineSpacing: 12 }
      ).setOrigin(0.5);
    } else {
      // Push the deadline and map-entry grace back by the time spent paused so neither jumps.
      // Dasher phase timers are shifted the same way.
      const pausedFor = this.time.now - this.pausedAt;
      this.deadline += pausedFor;
      this.safeUntil += pausedFor;
      for (const enemy of this.drones.getChildren()) {
        if (enemy.getData('kind') === 'dasher') enemy.data.values.phaseUntil += pausedFor;
      }
      this.physics.resume();
      this.pauseText.destroy();
    }
  }

  currentMap() {
    const key = `${this.mapCol},${this.mapRow}`;
    if (!this.maps[key]) {
      const map = { obstacles: this.randomObstacles() };
      this.maps[key] = map;
      map.coins = this.randomSpots(COIN_DASH.coinsPerMap, 60, 16);
    }
    return this.maps[key];
  }

  // Random walls {x, y, w, h} (top-left corner) away from the edges, the HUD, the minimap and
  // the player. Walls keep a wide gap between each other, so every open spot stays reachable.
  randomObstacles() {
    const c = COIN_DASH;
    const m = c.obstacleEdgeMargin, gap = 48;
    const centre = this.mapCol === Math.floor(c.mapCols / 2) && this.mapRow === Math.floor(c.mapRows / 2);
    const count = centre ? c.centreObstacles : Phaser.Math.Between(...c.obstaclesPerMap);
    const walls = [];
    for (let tries = 0; walls.length < count && tries < 200; tries++) {
      const long = Phaser.Math.Between(...c.obstacleLength);
      const thick = Phaser.Math.Between(...c.obstacleThickness);
      const [w, h] = Math.random() < 0.5 ? [long, thick] : [thick, long];
      const x = Phaser.Math.Between(m, c.width - m - w);
      const y = Phaser.Math.Between(44 + m, c.height - m - h);
      const rect = new Phaser.Geom.Rectangle(x, y, w, h);
      const nearMinimap = x + w > c.width - 90 && y + h > c.height - 90;
      const nearPlayer = Phaser.Geom.Intersects.CircleToRectangle(
        new Phaser.Geom.Circle(this.player.x, this.player.y, 60), rect);
      const nearWall = walls.some((o) => Phaser.Geom.Intersects.RectangleToRectangle(
        new Phaser.Geom.Rectangle(o.x - gap, o.y - gap, o.w + gap * 2, o.h + gap * 2), rect));
      if (!nearMinimap && !nearPlayer && !nearWall) walls.push({ x, y, w, h });
    }
    return walls;
  }

  // Random points inside the play area, at least minDistance away from the player
  // and at least clearance away from the current map's obstacles.
  randomSpots(count, minDistance, clearance) {
    const c = COIN_DASH;
    const walls = this.currentMap().obstacles;
    const spots = [];
    while (spots.length < count) {
      const x = Phaser.Math.Between(25, c.width - 25);
      const y = Phaser.Math.Between(70, c.height - 25);
      const blocked = walls.some((o) => Phaser.Geom.Intersects.CircleToRectangle(
        new Phaser.Geom.Circle(x, y, clearance), new Phaser.Geom.Rectangle(o.x, o.y, o.w, o.h)));
      if (!blocked && Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) >= minDistance) {
        spots.push({ x, y });
      }
    }
    return spots;
  }

  // Replace the previous map's obstacles, coins and drones with the current map's.
  enterMap() {
    const c = COIN_DASH;
    this.obstacles.clear(true, true);
    this.coins.clear(true, true);
    this.drones.clear(true, true);
    const base = Phaser.Display.Color.IntegerToColor(c.colors.background);
    this.background.setFillStyle(Phaser.Display.Color.GetColor(
      base.red + this.mapCol * 10, base.green + this.mapRow * 10, base.blue));
    for (const square of this.minimap) {
      const here = square.getData('col') === this.mapCol && square.getData('row') === this.mapRow;
      square.setFillStyle(here ? c.colors.player : 0x24334b, here ? 1 : 0.6);
    }
    for (const o of this.currentMap().obstacles) {
      this.obstacles.add(this.add.rectangle(o.x, o.y, o.w, o.h, c.colors.obstacle)
        .setOrigin(0).setStrokeStyle(2, 0x56698a));
    }
    for (const spot of this.currentMap().coins) {
      const coin = this.add.circle(spot.x, spot.y, 9, c.colors.coin).setData('spot', spot);
      this.coins.add(coin);
      coin.body.setCircle(9);
    }
    // Enemies spawn away from the entry point and the walls, and touching one is harmless for a
    // moment. Maps further from the centre get more and harder enemies.
    this.safeUntil = this.time.now + c.mapEntryGraceMs;
    const distance = Math.abs(this.mapCol - Math.floor(c.mapCols / 2))
      + Math.abs(this.mapRow - Math.floor(c.mapRows / 2));
    const counts = c.enemiesByDistance[Math.min(distance, c.enemiesByDistance.length - 1)];
    const kinds = [...Array(counts.drones).fill('drone'), ...Array(counts.chasers).fill('chaser'),
      ...Array(counts.dashers).fill('dasher')];
    this.randomSpots(kinds.length, 200, 20).forEach((spot, i) => this.spawnEnemy(kinds[i], spot));
  }

  // Drones are circles bouncing at a slightly varied speed; chasers are squares, dashers triangles.
  spawnEnemy(kind, spot) {
    const c = COIN_DASH;
    const enemy = kind === 'chaser' ? this.add.rectangle(spot.x, spot.y, 24, 24, c.colors.chaser)
      : kind === 'dasher' ? this.add.triangle(spot.x, spot.y, 0, 26, 13, 0, 26, 26, c.colors.dasher)
      : this.add.circle(spot.x, spot.y, 13, c.colors.drone);
    enemy.setData('kind', kind);
    this.drones.add(enemy);
    enemy.body.setCollideWorldBounds(true).setBounce(1, 1);
    // Hit areas are circles inside the square and triangle so their corners don't feel unfair.
    if (kind === 'chaser') enemy.body.setCircle(12);
    if (kind === 'dasher') enemy.body.setCircle(11, 2, 3);
    const jitter = Phaser.Math.Between(-c.droneSpeedJitter, c.droneSpeedJitter);
    const speed = { drone: c.droneSpeed + jitter, chaser: 0, dasher: c.dasher.driftSpeed }[kind];
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    enemy.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    // Dashers drift, then wind up (shown by fading) and lunge at the player;
    // the first wind-up waits until well after the map-entry grace period.
    if (kind === 'dasher') {
      enemy.setData({ phase: 'drift', phaseUntil: this.safeUntil + c.dasher.intervalMs / 2 });
    }
  }

  // Steer chasers toward the player and step dashers through drift, wind-up and dash.
  moveEnemies() {
    const c = COIN_DASH, now = this.time.now;
    for (const enemy of this.drones.getChildren()) {
      const kind = enemy.getData('kind');
      const toPlayer = new Phaser.Math.Vector2(this.player.x - enemy.x, this.player.y - enemy.y)
        .normalize();
      if (kind === 'chaser') {
        const speed = now < this.safeUntil ? 0 : c.chaserSpeed;
        enemy.body.setVelocity(toPlayer.x * speed, toPlayer.y * speed);
      } else if (kind === 'dasher' && now >= enemy.getData('phaseUntil')) {
        const phase = enemy.getData('phase');
        if (phase === 'drift') {
          enemy.setData({ phase: 'windup', phaseUntil: now + c.dasher.windupMs }).setAlpha(0.45);
          enemy.body.setVelocity(0, 0);
        } else if (phase === 'windup') {
          enemy.setData({ phase: 'dash', phaseUntil: now + c.dasher.dashMs }).setAlpha(1);
          enemy.body.setVelocity(toPlayer.x * c.dasher.dashSpeed, toPlayer.y * c.dasher.dashSpeed);
        } else {
          enemy.setData({ phase: 'drift', phaseUntil: now + c.dasher.intervalMs });
          enemy.body.velocity.normalize().scale(c.dasher.driftSpeed);
        }
      }
    }
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
    if (this.finished || this.paused) return;
    this.checkEdges();
    const dx = Number(this.cursors.right.isDown || this.keys.D.isDown)
      - Number(this.cursors.left.isDown || this.keys.A.isDown);
    const dy = Number(this.cursors.down.isDown || this.keys.S.isDown)
      - Number(this.cursors.up.isDown || this.keys.W.isDown);
    const direction = new Phaser.Math.Vector2(dx, dy).normalize().scale(COIN_DASH.playerSpeed);
    this.player.body.setVelocity(direction.x, direction.y);
    this.moveEnemies();
    const seconds = Math.max(0, Math.ceil((this.deadline - this.time.now) / 1000));
    const map = `Map ${this.mapCol + 1},${this.mapRow + 1}`;
    this.hud.setText(`Coins: ${this.score}     Best: ${this.highScore}     ${map}     Time: ${seconds}s`);
    if (seconds === 0) this.finish('Time is up!');
  }

  finish(reason) {
    if (this.finished) return;
    this.finished = true;
    this.physics.pause();
    const c = COIN_DASH;
    this.add.rectangle(c.width / 2, c.height / 2, 460, 150, 0x0a1120, 0.95);
    this.add.text(c.width / 2, c.height / 2,
      `${reason}\n${this.score} coins collected (best: ${this.highScore})\nPress R to try again`,
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
