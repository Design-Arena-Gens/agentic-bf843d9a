"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Fighter, Technique, fighters } from "./fighters";

type Phase = "menu" | "countdown" | "playing" | "finished";

type PlayerState = {
  fighter: Fighter;
  x: number;
  y: number;
  vx: number;
  direction: 1 | -1;
  hp: number;
  attackCooldown: number;
  currentAttack: AttackState | null;
  specialCooldowns: Record<string, number>;
  hurtTimer: number;
  stamina: number;
};

type AttackState = {
  damage: number;
  range: number;
  duration: number;
  elapsed: number;
  hasConnected: boolean;
  windup: number;
};

type Projectile = {
  id: string;
  owner: 0 | 1;
  x: number;
  y: number;
  speed: number;
  size: number;
  direction: 1 | -1;
  damage: number;
  color: string;
  life: number;
};

type GameState = {
  players: [PlayerState, PlayerState];
  projectiles: Projectile[];
  lastTimestamp: number;
  winner: 0 | 1 | null;
  timer: number;
};

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;
const FLOOR_Y = CANVAS_HEIGHT - 140;
const PLAYER_WIDTH = 80;
const PLAYER_HEIGHT = 160;
const FRICTION = 0.86;
const MOVE_ACCEL = 0.38;
const MAX_SPEED = 4.4;
const BASIC_ATTACK_COOLDOWN = 900;
const BASIC_ATTACK_DAMAGE = 10;
const BASIC_ATTACK_RANGE = 90;
const BASIC_ATTACK_WINDUP = 120;
const BASIC_ATTACK_DURATION = 280;
const ROUND_TIME_MS = 90_000;

const PLAYER_INPUTS = {
  left: new Set(["ArrowLeft", "a", "A"]),
  right: new Set(["ArrowRight", "d", "D"]),
  up: new Set(["ArrowUp", "w", "W"]),
  down: new Set(["ArrowDown", "s", "S"]),
  attack: new Set(["j", "J", "f", "F"]),
  specialPrimary: new Set(["k", "K"]),
  specialSecondary: new Set(["l", "L"])
};

const createPlayerState = (
  fighter: Fighter,
  index: 0 | 1
): PlayerState => ({
  fighter,
  x: index === 0 ? CANVAS_WIDTH * 0.25 : CANVAS_WIDTH * 0.75,
  y: FLOOR_Y,
  vx: 0,
  direction: index === 0 ? 1 : -1,
  hp: 100,
  attackCooldown: 0,
  currentAttack: null,
  specialCooldowns: Object.fromEntries(
    fighter.specials.map((technique) => [technique.id, 0])
  ),
  hurtTimer: 0,
  stamina: 100
});

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const collides = (
  ax: number,
  aw: number,
  bx: number,
  bw: number,
  range: number
) => {
  const aLeft = ax - aw * 0.5;
  const aRight = ax + aw * 0.5 + range;
  const bLeft = bx - bw * 0.5;
  const bRight = bx + bw * 0.5;
  return aRight >= bLeft && aLeft <= bRight;
};

export function FightingGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [phase, setPhase] = useState<Phase>("menu");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [selectedFighterId, setSelectedFighterId] = useState<Fighter["id"]>(
    "naruto"
  );
  const [enemyId, setEnemyId] = useState<Fighter["id"]>("sasuke");
  const [hud, setHud] = useState({
    playerHp: 100,
    enemyHp: 100,
    timer: ROUND_TIME_MS,
    message: "Выбери бойца и начни бой!"
  });
  const gameStateRef = useRef<GameState | null>(null);
  const inputsRef = useRef<Record<string, boolean>>({
    left: false,
    right: false,
    up: false,
    down: false,
    attack: false,
    specialPrimary: false,
    specialSecondary: false
  });

  const selectedFighter = useMemo(
    () => fighters.find((fighter) => fighter.id === selectedFighterId)!,
    [selectedFighterId]
  );

  const enemyFighter = useMemo(
    () => fighters.find((fighter) => fighter.id === enemyId)!,
    [enemyId]
  );

  const resetGameState = (player: Fighter, enemy: Fighter) => {
    gameStateRef.current = {
      players: [createPlayerState(player, 0), createPlayerState(enemy, 1)],
      projectiles: [],
      lastTimestamp: 0,
      winner: null,
      timer: ROUND_TIME_MS
    };
  };

  const handleStart = () => {
    resetGameState(selectedFighter, enemyFighter);
    setHud({
      playerHp: 100,
      enemyHp: 100,
      timer: ROUND_TIME_MS,
      message: "Готовься к бою!"
    });
    inputsRef.current = {
      left: false,
      right: false,
      up: false,
      down: false,
      attack: false,
      specialPrimary: false,
      specialSecondary: false
    };
    setPhase("countdown");
    setCountdown(3);
  };

  const finishRound = useCallback(
    (winner: 0 | 1 | null) => {
      setPhase("finished");
      const playerName =
        winner === 0
          ? selectedFighter.name
          : winner === 1
            ? enemyFighter.name
            : "Никто";
      const message =
        winner === null
          ? "Ничья! Раунд завершился по таймеру."
          : `${playerName} побеждает!`;
      setHud((prev) => ({
        ...prev,
        message
      }));
    },
    [enemyFighter.name, selectedFighter.name]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      for (const [input, keys] of Object.entries(PLAYER_INPUTS)) {
        if (keys.has(event.key)) {
          event.preventDefault();
          inputsRef.current[input] = true;
        }
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      for (const [input, keys] of Object.entries(PLAYER_INPUTS)) {
        if (keys.has(event.key)) {
          inputsRef.current[input] = false;
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    if (phase !== "countdown") {
      setCountdown(null);
      return;
    }

    if (countdown === null) {
      return;
    }

    if (countdown <= 0) {
      setPhase("playing");
      setHud((prev) => ({ ...prev, message: "Бой начался!" }));
      return;
    }

    const timeout = window.setTimeout(() => {
      setCountdown((prev) => (prev !== null ? prev - 1 : prev));
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [phase, countdown]);

  const triggerTechnique = useCallback((player: PlayerState, index: number) => {
    const technique = player.fighter.specials[index];
    if (!technique) return;
    if (player.specialCooldowns[technique.id] > 0) return;

    player.specialCooldowns[technique.id] = technique.cooldown;
    if (technique.projectileSpeed > 0) {
      const projectile: Projectile = {
        id: `${technique.id}-${Date.now()}-${Math.random()}`,
        owner: 0,
        x: player.x + player.direction * (PLAYER_WIDTH * 0.65),
        y: player.y,
        speed: technique.projectileSpeed * 8,
        size: technique.projectileSize,
        direction: player.direction,
        damage: technique.damage * player.fighter.power,
        color: technique.color,
        life: technique.range
      };
      gameStateRef.current?.projectiles.push(projectile);
    } else if (technique.damage < 0) {
      player.hp = clamp(player.hp - technique.damage, 0, 100);
    } else {
      player.currentAttack = {
        damage: technique.damage * player.fighter.power,
        range: technique.range,
        duration: 360,
        elapsed: 0,
        hasConnected: false,
        windup: 80
      };
    }
  }, []);

  const processPlayerInput = useCallback((
    player: PlayerState,
    delta: number,
    inputs: Record<string, boolean>
  ) => {
    const horizontal = (inputs.right ? 1 : 0) - (inputs.left ? 1 : 0);
    player.vx += horizontal * MOVE_ACCEL * player.fighter.speed;
    player.vx *= FRICTION;
    player.vx = clamp(player.vx, -MAX_SPEED, MAX_SPEED);
    player.direction = horizontal !== 0 ? (horizontal > 0 ? 1 : -1) : player.direction;

    if (player.attackCooldown > 0) {
      player.attackCooldown = Math.max(0, player.attackCooldown - delta);
    }

    if (player.hurtTimer > 0) {
      player.hurtTimer = Math.max(0, player.hurtTimer - delta);
    }

    for (const technique of player.fighter.specials) {
      player.specialCooldowns[technique.id] = Math.max(
        0,
        player.specialCooldowns[technique.id] - delta
      );
    }

    if (!player.currentAttack && inputs.attack && player.attackCooldown === 0) {
      player.currentAttack = {
        damage: BASIC_ATTACK_DAMAGE * player.fighter.power,
        range: BASIC_ATTACK_RANGE,
        duration: BASIC_ATTACK_DURATION,
        elapsed: 0,
        hasConnected: false,
        windup: BASIC_ATTACK_WINDUP
      };
      player.attackCooldown = BASIC_ATTACK_COOLDOWN / player.fighter.speed;
    }

    if (inputs.specialPrimary) {
      triggerTechnique(player, 0);
    }
    if (inputs.specialSecondary) {
      triggerTechnique(player, 1);
    }
  }, [triggerTechnique]);

  const triggerCpuTechnique = useCallback((enemy: PlayerState, technique?: Technique) => {
    if (!technique) return;
    if (enemy.specialCooldowns[technique.id] > 0) return;

    enemy.specialCooldowns[technique.id] = technique.cooldown;
    if (technique.projectileSpeed > 0) {
      const projectile: Projectile = {
        id: `${technique.id}-${Date.now()}-${Math.random()}`,
        owner: 1,
        x: enemy.x + enemy.direction * (PLAYER_WIDTH * 0.65),
        y: enemy.y,
        speed: technique.projectileSpeed * 8,
        size: technique.projectileSize,
        direction: enemy.direction,
        damage: technique.damage * enemy.fighter.power,
        color: technique.color,
        life: technique.range
      };
      gameStateRef.current?.projectiles.push(projectile);
    } else if (technique.damage < 0) {
      enemy.hp = clamp(enemy.hp - technique.damage, 0, 100);
    } else {
      enemy.currentAttack = {
        damage: technique.damage * enemy.fighter.power,
        range: technique.range,
        duration: 360,
        elapsed: 0,
        hasConnected: false,
        windup: 80
      };
    }
  }, []);

  const processCpu = useCallback((enemy: PlayerState, player: PlayerState, delta: number) => {
    const distance = player.x - enemy.x;
    const targetDirection = distance > 0 ? 1 : -1;
    const absDistance = Math.abs(distance);

    enemy.direction = targetDirection;

    if (absDistance > 280) {
      enemy.vx += targetDirection * MOVE_ACCEL * 0.8 * enemy.fighter.speed;
    } else if (absDistance < 190) {
      enemy.vx -= targetDirection * MOVE_ACCEL * 0.6;
    } else {
      enemy.vx *= 0.9;
    }
    enemy.vx = clamp(enemy.vx, -MAX_SPEED, MAX_SPEED);
    enemy.vx *= FRICTION;

    if (enemy.attackCooldown > 0) {
      enemy.attackCooldown = Math.max(0, enemy.attackCooldown - delta);
    }

    if (!enemy.currentAttack && enemy.attackCooldown === 0) {
      if (absDistance < BASIC_ATTACK_RANGE + PLAYER_WIDTH) {
        enemy.currentAttack = {
          damage: BASIC_ATTACK_DAMAGE * enemy.fighter.power,
          range: BASIC_ATTACK_RANGE,
          duration: BASIC_ATTACK_DURATION,
          elapsed: 0,
          hasConnected: false,
          windup: BASIC_ATTACK_WINDUP
        };
        enemy.attackCooldown = BASIC_ATTACK_COOLDOWN / enemy.fighter.speed;
      }
    }

    for (const technique of enemy.fighter.specials) {
      enemy.specialCooldowns[technique.id] = Math.max(
        0,
        enemy.specialCooldowns[technique.id] - delta
      );
    }

    const longRange = enemy.fighter.specials[1];
    if (longRange && absDistance > 240 && enemy.specialCooldowns[longRange.id] === 0) {
      triggerCpuTechnique(enemy, longRange);
    }

    const closeRange = enemy.fighter.specials[0];
    if (
      closeRange &&
      absDistance < 200 &&
      enemy.specialCooldowns[closeRange.id] === 0
    ) {
      triggerCpuTechnique(enemy, closeRange);
    }
  }, [triggerCpuTechnique]);

  const applyDamage = useCallback((target: PlayerState, damage: number) => {
    target.hp = clamp(target.hp - damage, 0, 100);
    target.hurtTimer = 320;
  }, []);

  const updatePlayer = useCallback(
    (player: PlayerState, delta: number, state: GameState) => {
      player.x += player.vx * delta * 0.12;
      player.x = clamp(player.x, PLAYER_WIDTH * 0.5, CANVAS_WIDTH - PLAYER_WIDTH * 0.5);

      if (player.currentAttack) {
        player.currentAttack.elapsed += delta;
        if (
          player.currentAttack.elapsed >= player.currentAttack.windup &&
          !player.currentAttack.hasConnected
        ) {
          const opponent = state.players[player === state.players[0] ? 1 : 0];
          if (
            collides(
              player.x + player.direction * PLAYER_WIDTH * 0.4,
              PLAYER_WIDTH,
              opponent.x,
              PLAYER_WIDTH,
              player.currentAttack.range
            )
          ) {
            player.currentAttack.hasConnected = true;
            applyDamage(opponent, player.currentAttack.damage);
          }
        }
        if (player.currentAttack.elapsed >= player.currentAttack.duration) {
          player.currentAttack = null;
        }
      }
    },
    [applyDamage]
  );

  const updateProjectiles = useCallback(
    (state: GameState, delta: number) => {
      const next: Projectile[] = [];
      for (const projectile of state.projectiles) {
        const sign = projectile.direction;
        const distance = projectile.speed * delta * 0.12;
        projectile.x += distance * sign;
        projectile.life -= Math.abs(distance);
        const target =
          projectile.owner === 0 ? state.players[1] : state.players[0];
        if (
          Math.abs(projectile.x - target.x) <
            projectile.size + PLAYER_WIDTH * 0.5 &&
          projectile.life > 0
        ) {
          applyDamage(target, projectile.damage);
          continue;
        }
        if (projectile.life > 0) {
          next.push(projectile);
        }
      }
      state.projectiles = next;
    },
    [applyDamage]
  );

  const resolveCollisions = useCallback(
    (player: PlayerState, enemy: PlayerState) => {
      const distance = player.x - enemy.x;
      const overlap =
        PLAYER_WIDTH - Math.abs(distance) + PLAYER_WIDTH * 0.4;
      if (overlap > 0) {
        const push = overlap * 0.5;
        player.x += push;
        enemy.x -= push;
        player.x = clamp(player.x, PLAYER_WIDTH * 0.5, CANVAS_WIDTH - PLAYER_WIDTH * 0.5);
        enemy.x = clamp(enemy.x, PLAYER_WIDTH * 0.5, CANVAS_WIDTH - PLAYER_WIDTH * 0.5);
      }
    },
    []
  );

  const updateGameState = useCallback((
    state: GameState,
    delta: number,
    inputs: Record<string, boolean>
  ) => {
    const [player, enemy] = state.players;

    state.timer = Math.max(0, state.timer - delta);

    processPlayerInput(player, delta, inputs);
    processCpu(enemy, player, delta);

    updatePlayer(player, delta, state);
    updatePlayer(enemy, delta, state);

    updateProjectiles(state, delta);

    resolveCollisions(player, enemy);

    if (enemy.hp <= 0 && player.hp <= 0) {
      state.winner = null;
    } else if (enemy.hp <= 0) {
      state.winner = 0;
    } else if (player.hp <= 0) {
      state.winner = 1;
    }

    if (state.timer <= 0 && state.winner === null) {
      if (player.hp === enemy.hp) {
        state.winner = null;
      } else {
        state.winner = player.hp > enemy.hp ? 0 : 1;
      }
    }
  }, [processCpu, processPlayerInput, resolveCollisions, updatePlayer, updateProjectiles]);

  useEffect(() => {
    if (phase !== "playing") {
      return;
    }

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !gameStateRef.current) {
      return;
    }

    let animationFrame: number;

    const drawBackdrop = (ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = "#05070b";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      gradient.addColorStop(0, "#20263a");
      gradient.addColorStop(0.6, "#101420");
      gradient.addColorStop(1, "#05070b");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.fillStyle = "#0b0f16";
      ctx.fillRect(0, FLOOR_Y + PLAYER_HEIGHT * 0.5, CANVAS_WIDTH, 10);
      ctx.fillStyle = "#161d2b";
      ctx.fillRect(0, FLOOR_Y + PLAYER_HEIGHT * 0.5 + 10, CANVAS_WIDTH, 80);

      for (let i = 0; i < 5; i++) {
        const alpha = 0.08 + i * 0.04;
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fillRect(0, FLOOR_Y + 95 + i * 8, CANVAS_WIDTH, 2);
      }
    };

    const drawPlayer = (ctx: CanvasRenderingContext2D, player: PlayerState) => {
      const { fighter } = player;
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.scale(player.direction, 1);

      ctx.fillStyle = "#05070b";
      ctx.fillRect(-PLAYER_WIDTH * 0.5, 76, PLAYER_WIDTH, PLAYER_HEIGHT - 76);

      const gradient = ctx.createLinearGradient(
        -PLAYER_WIDTH * 0.5,
        -PLAYER_HEIGHT * 0.5,
        PLAYER_WIDTH,
        PLAYER_HEIGHT
      );
      gradient.addColorStop(0, "rgba(255,255,255,0.12)");
      gradient.addColorStop(1, "rgba(10,10,10,0.2)");
      ctx.fillStyle = gradient;
      ctx.fillRect(-PLAYER_WIDTH * 0.5, -PLAYER_HEIGHT * 0.5, PLAYER_WIDTH, PLAYER_HEIGHT);

      ctx.fillStyle = player.hurtTimer > 0 ? "rgba(255, 255, 255, 0.45)" : fighter.aura;
      ctx.fillRect(-PLAYER_WIDTH * 0.5, -PLAYER_HEIGHT * 0.5, PLAYER_WIDTH, PLAYER_HEIGHT);

      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(-PLAYER_WIDTH * 0.52, PLAYER_HEIGHT * 0.28, PLAYER_WIDTH * 1.04, PLAYER_HEIGHT * 0.6);

      ctx.restore();
    };

    const drawProjectiles = (
      ctx: CanvasRenderingContext2D,
      projectiles: Projectile[]
    ) => {
      for (const projectile of projectiles) {
        ctx.beginPath();
        ctx.fillStyle = projectile.color;
        ctx.shadowColor = projectile.color;
        ctx.shadowBlur = 20;
        ctx.arc(projectile.x, projectile.y - PLAYER_HEIGHT * 0.3, projectile.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    };

    const loop = (timestamp: number) => {
      const state = gameStateRef.current;
      if (!state) {
        animationFrame = requestAnimationFrame(loop);
        return;
      }

      if (!state.lastTimestamp) {
        state.lastTimestamp = timestamp;
      }

      const delta = clamp(timestamp - state.lastTimestamp, 0, 48);
      state.lastTimestamp = timestamp;

      updateGameState(state, delta, inputsRef.current);
      drawBackdrop(context);
      drawPlayer(context, state.players[0]);
      drawPlayer(context, state.players[1]);
      drawProjectiles(context, state.projectiles);

      setHud((prev) => ({
        ...prev,
        playerHp: state.players[0].hp,
        enemyHp: state.players[1].hp,
        timer: state.timer
      }));

      if (state.winner !== null || state.timer <= 0) {
        finishRound(state.winner);
        return;
      }

      animationFrame = requestAnimationFrame(loop);
    };

    animationFrame = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(animationFrame);
  }, [phase, finishRound, updateGameState]);

  return (
    <div className="game-shell">
      <div className="hud-panel">
        <div className="fighter-card">
          <span className="label">Твой боец</span>
          <h1>{selectedFighter.name}</h1>
          <p>{selectedFighter.signature}</p>
          <div className="techniques">
            {selectedFighter.specials.map((special) => (
              <div key={special.id} className="technique">
                <span className="keycap">{special.key}</span>
                <div>
                  <strong>{special.name}</strong>
                  <p>{special.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="controls">
          <span className="label">Управление</span>
          <ul>
            <li>W/A/S/D или стрелки — движение</li>
            <li>J/F — базовая атака</li>
            <li>K и L — техники</li>
          </ul>
        </div>
      </div>
      <div className="center-panel">
        <header className="scoreboard">
          <div className="life-bar">
            <span>{selectedFighter.name}</span>
            <div className="bar">
              <div
                className="fill"
                style={{
                  width: `${hud.playerHp}%`,
                  background: selectedFighter.aura
                }}
              />
            </div>
          </div>
          <div className="timer">
            {Math.ceil(hud.timer / 1000)}
            <small>сек</small>
          </div>
          <div className="life-bar">
            <span>{enemyFighter.name}</span>
            <div className="bar">
              <div
                className="fill"
                style={{
                  width: `${hud.enemyHp}%`,
                  background: enemyFighter.aura
                }}
              />
            </div>
          </div>
        </header>
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="arena"
        />
        <div className="message">
          {phase === "countdown" && countdown !== null
            ? `Бой начнётся через ${countdown}`
            : phase === "finished"
              ? hud.message
              : hud.message}
        </div>
        <div className="menu">
          <div className="selectors">
            <div className="selector">
              <label>Твой ниндзя</label>
              <div className="fighter-grid">
                {fighters.map((fighter) => (
                  <button
                    key={fighter.id}
                    className={`fighter-button ${
                      fighter.id === selectedFighterId ? "active" : ""
                    }`}
                    style={{ background: fighter.aura }}
                    onClick={() => setSelectedFighterId(fighter.id)}
                    disabled={phase === "playing" || phase === "countdown"}
                  >
                    <span>{fighter.name}</span>
                    <small>{fighter.signature}</small>
                  </button>
                ))}
              </div>
            </div>
            <div className="selector">
              <label>Противник</label>
              <div className="fighter-grid">
                {fighters
                  .filter((fighter) => fighter.id !== selectedFighterId)
                  .map((fighter) => (
                    <button
                      key={fighter.id}
                      className={`fighter-button ${
                        fighter.id === enemyId ? "active" : ""
                      }`}
                      style={{ background: fighter.aura }}
                      onClick={() => setEnemyId(fighter.id)}
                      disabled={phase === "playing" || phase === "countdown"}
                    >
                      <span>{fighter.name}</span>
                      <small>{fighter.signature}</small>
                    </button>
                  ))}
              </div>
            </div>
          </div>
          <button
            className="start-button"
            onClick={handleStart}
            disabled={phase === "playing" || phase === "countdown"}
          >
            Начать бой
          </button>
          {phase === "finished" && (
            <button
              className="start-button secondary"
              onClick={() => {
                resetGameState(selectedFighter, enemyFighter);
                setPhase("menu");
                setHud({
                  playerHp: 100,
                  enemyHp: 100,
                  timer: ROUND_TIME_MS,
                  message: "Выбери бойца и начни бой!"
                });
              }}
            >
              Новый раунд
            </button>
          )}
        </div>
      </div>
      <div className="hud-panel">
        <div className="fighter-card">
          <span className="label">Противник</span>
          <h1>{enemyFighter.name}</h1>
          <p>{enemyFighter.signature}</p>
          <div className="techniques">
            {enemyFighter.specials.map((special) => (
              <div key={special.id} className="technique">
                <span className="keycap">{special.key}</span>
                <div>
                  <strong>{special.name}</strong>
                  <p>{special.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="since">
          <span className="label">Чакра</span>
          <p>
            Каждая техника имеет откат. Применяй навыки вовремя, комбинируй атаки и
            контролируй дистанцию, чтобы победить.
          </p>
        </div>
      </div>
    </div>
  );
}
