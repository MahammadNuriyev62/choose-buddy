#!/usr/bin/env node
// choose-buddy — pick your Claude Code companion species
// Works with Node.js 16+ or Bun. No dependencies.
//
// Usage:
//   node choose-buddy.mjs <species>                     Pick a species (finds best rarity)
//   node choose-buddy.mjs <species> --rarity <rarity>   Pick species + rarity
//   node choose-buddy.mjs <species> --persist           Pick + auto-repatch on updates
//   node choose-buddy.mjs --list                        List all species
//   node choose-buddy.mjs --info                        Show your current companion
//   node choose-buddy.mjs --restore                     Restore original binary

import { readFileSync, writeFileSync, copyFileSync, chmodSync, statSync, renameSync, realpathSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { createHash } from "crypto";
import { execSync } from "child_process";
import { homedir, platform } from "os";

// ─── Wyhash (pure JS port of Zig's std.hash.Wyhash, identical to Bun.hash) ───

const M = (1n << 64n) - 1n;
const S = [0xa0761d6478bd642fn, 0xe7037ed1a0b428dbn, 0x8ebc6af09c88c6e3n, 0x589965cc75374cc3n];

function r8(b, o) {
  let v = 0n;
  for (let i = 0; i < 8; i++) v |= BigInt(b[o + i]) << BigInt(8 * i);
  return v & M;
}

function r4(b, o) {
  return (BigInt(b[o]) | (BigInt(b[o+1]) << 8n) | (BigInt(b[o+2]) << 16n) | (BigInt(b[o+3]) << 24n)) & M;
}

function mum(a, b) {
  const x = (a & M) * (b & M);
  return [(x & M), ((x >> 64n) & M)];
}

function mix(a, b) {
  const [lo, hi] = mum(a, b);
  return (lo ^ hi) & M;
}

function wyHash(input, seed = 0n) {
  seed = BigInt(seed) & M;
  const len = input.length;
  let s0 = (seed ^ mix((seed ^ S[0]) & M, S[1])) & M;
  let s1 = s0, s2 = s0;
  let a, b;

  if (len <= 16) {
    if (len >= 4) {
      const end = len - 4, quarter = (len >> 3) << 2;
      a = ((r4(input, 0) << 32n) | r4(input, quarter)) & M;
      b = ((r4(input, end) << 32n) | r4(input, end - quarter)) & M;
    } else if (len > 0) {
      a = ((BigInt(input[0]) << 16n) | (BigInt(input[len >> 1]) << 8n) | BigInt(input[len - 1])) & M;
      b = 0n;
    } else { a = 0n; b = 0n; }
  } else {
    let i = 0;
    if (len >= 48) {
      while (i + 48 < len) {
        s0 = mix((r8(input, i) ^ S[1]) & M, (r8(input, i + 8) ^ s0) & M);
        s1 = mix((r8(input, i + 16) ^ S[2]) & M, (r8(input, i + 24) ^ s1) & M);
        s2 = mix((r8(input, i + 32) ^ S[3]) & M, (r8(input, i + 40) ^ s2) & M);
        i += 48;
      }
      s0 = (s0 ^ s1 ^ s2) & M;
    }
    let ri = i;
    while (ri + 16 < len) {
      s0 = mix((r8(input, ri) ^ S[1]) & M, (r8(input, ri + 8) ^ s0) & M);
      ri += 16;
    }
    a = r8(input, len - 16);
    b = r8(input, len - 8);
  }

  a = (a ^ S[1]) & M; b = (b ^ s0) & M;
  [a, b] = mum(a, b);
  return mix((a ^ S[0] ^ BigInt(len)) & M, (b ^ S[1]) & M);
}

function hashString(s) {
  return Number(wyHash(new TextEncoder().encode(s), 0n) & 0xffffffffn);
}

// ─── Companion roll logic (mirrors src/buddy/companion.ts) ───

const SPECIES = [
  "duck", "goose", "blob", "cat", "dragon", "octopus", "owl", "penguin",
  "turtle", "snail", "ghost", "axolotl", "capybara", "cactus", "robot",
  "rabbit", "mushroom", "chonk",
];
const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];
const RARITY_WEIGHTS = { common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1 };
const EYES = ["·", "✦", "×", "◉", "@", "°"];
const HATS = ["none", "crown", "tophat", "propeller", "halo", "wizard", "beanie", "tinyduck"];
const STAT_NAMES = ["DEBUGGING", "PATIENCE", "CHAOS", "WISDOM", "SNARK"];
const ORIGINAL_SALT = "friend-2026-401";
const SALT_LEN = ORIGINAL_SALT.length;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function rollRarity(rng) {
  const total = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (const r of RARITIES) { roll -= RARITY_WEIGHTS[r]; if (roll < 0) return r; }
  return "common";
}

function rollFull(userId, salt) {
  const rng = mulberry32(hashString(userId + salt));
  const rarity = rollRarity(rng);
  const species = pick(rng, SPECIES);
  const eye = pick(rng, EYES);
  const hat = rarity === "common" ? "none" : pick(rng, HATS);
  const shiny = rng() < 0.01;
  const floor = { common: 5, uncommon: 15, rare: 25, epic: 35, legendary: 50 }[rarity];
  const peak = pick(rng, STAT_NAMES);
  let dump = pick(rng, STAT_NAMES);
  while (dump === peak) dump = pick(rng, STAT_NAMES);
  const stats = {};
  for (const n of STAT_NAMES) {
    if (n === peak) stats[n] = Math.min(100, floor + 50 + Math.floor(rng() * 30));
    else if (n === dump) stats[n] = Math.max(1, floor - 10 + Math.floor(rng() * 15));
    else stats[n] = floor + Math.floor(rng() * 40);
  }
  return { rarity, species, eye, hat, shiny, stats };
}

// ─── Config helpers ───

const HOME = homedir();

function getConfigPath() {
  return join(HOME, ".claude.json");
}

function readConfig() {
  return JSON.parse(readFileSync(getConfigPath(), "utf-8"));
}

function atomicWrite(filePath, content) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.tmp.${process.pid}`;
  try {
    writeFileSync(tmp, content);
    renameSync(tmp, filePath);
  } catch (e) {
    try { unlinkSync(tmp); } catch {}
    throw e;
  }
}

function writeConfig(config) {
  atomicWrite(getConfigPath(), JSON.stringify(config, null, 2));
}

function getUserId(config) {
  return config.oauthAccount?.accountUuid ?? config.userID ?? "anon";
}

function getBinaryPath() {
  const os = platform();

  const candidates = [];

  if (os === "darwin") {
    candidates.push(
      join(HOME, ".local", "bin", "claude"),
      "/opt/homebrew/bin/claude",
      "/usr/local/bin/claude",
    );
  } else {
    candidates.push(
      join(HOME, ".local", "bin", "claude"),
      "/usr/local/bin/claude",
    );
  }

  try {
    const which = execSync("which claude", { encoding: "utf-8" }).trim();
    if (which && !candidates.includes(which)) candidates.unshift(which);
  } catch {}

  for (const p of candidates) {
    try {
      statSync(p);
      return realpathSync(p);
    } catch {}
  }

  return null;
}

// ─── Brute force salt ───

function findBestSalt(userId, targetSpecies, targetRarity) {
  const rarityRank = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
  let best = null;
  for (let i = 0; i < 500_000; i++) {
    const salt = createHash("md5").update(`${i}`).digest("hex").slice(0, SALT_LEN);
    const r = rollFull(userId, salt);
    if (r.species !== targetSpecies) continue;
    if (targetRarity && r.rarity !== targetRarity) continue;
    if (!best || rarityRank[r.rarity] > rarityRank[best.rarity] ||
        (rarityRank[r.rarity] === rarityRank[best.rarity] && r.shiny && !best.shiny)) {
      best = { salt, ...r };
      if (r.rarity === "legendary" && r.shiny) break;
    }
  }
  return best;
}

// ─── Patch binary ───

function patchBinary(binaryPath, newSalt) {
  const oldBytes = Buffer.from(ORIGINAL_SALT, "utf-8");
  const newBytes = Buffer.from(newSalt, "utf-8");

  if (newBytes.length !== oldBytes.length) {
    throw new Error(`Salt length mismatch: expected ${oldBytes.length}, got ${newBytes.length}`);
  }

  const backupPath = binaryPath + ".original";

  // If the current binary contains the original salt it is unpatched
  // (fresh install or update). Back it up, replacing any stale backup.
  const currentData = readFileSync(binaryPath);
  if (currentData.indexOf(oldBytes) !== -1) {
    copyFileSync(binaryPath, backupPath);
  }

  if (!existsSync(backupPath)) {
    throw new Error(
      `No backup at ${backupPath} and binary lacks original salt.\n` +
      "Try --restore first, then re-run."
    );
  }

  const data = readFileSync(backupPath);
  const patched = Buffer.from(data);
  let count = 0, offset = 0;
  while (true) {
    const idx = patched.indexOf(oldBytes, offset);
    if (idx === -1) break;
    newBytes.copy(patched, idx);
    offset = idx + newBytes.length;
    count++;
  }

  if (count === 0) {
    throw new Error("Could not find salt in backup binary. Is this a supported Claude Code version?");
  }

  const tmpPath = `${binaryPath}.patching.${process.pid}`;
  try {
    writeFileSync(tmpPath, patched);
    chmodSync(tmpPath, statSync(backupPath).mode);
    renameSync(tmpPath, binaryPath);
  } catch (e) {
    try { unlinkSync(tmpPath); } catch {}
    throw e;
  }

  return count;
}

// ─── Saved choice + shell hook (persists across updates) ───

const CHOICE_FILE = join(HOME, ".claude", "buddy-choice.json");

function saveChoice(species, rarity, scriptPath) {
  atomicWrite(CHOICE_FILE, JSON.stringify({ species, rarity: rarity || null, script: scriptPath }));
}

function loadChoice() {
  try { return JSON.parse(readFileSync(CHOICE_FILE, "utf-8")); } catch { return null; }
}

function clearChoice() {
  try { unlinkSync(CHOICE_FILE); } catch {}
}

function needsPatch(binaryPath) {
  // Always check the actual binary content. A stale .original from a
  // previous version must not trick us into skipping a fresh binary.
  try {
    const data = readFileSync(binaryPath);
    return data.indexOf(Buffer.from(ORIGINAL_SALT)) !== -1;
  } catch {
    return false;
  }
}

function applyChoice(quiet) {
  try {
    const choice = loadChoice();
    if (!choice?.species) return;

    const binaryPath = getBinaryPath();
    if (!binaryPath) return;
    if (!needsPatch(binaryPath)) return;

    const config = readConfig();
    const userId = getUserId(config);

    if (!quiet) console.log(`New Claude Code version detected. Re-applying buddy choice: ${choice.species}...`);

    const result = findBestSalt(userId, choice.species, choice.rarity);
    if (!result) {
      if (!quiet) console.error(`Could not find salt for ${choice.species}`);
      return;
    }

    const count = patchBinary(binaryPath, result.salt);
    delete config.companion;
    writeConfig(config);

    if (!quiet) console.log(`Patched ${count} locations. Your ${result.rarity} ${result.species} will return on next launch.`);
  } catch (e) {
    if (!quiet) console.error(`Auto-patch failed: ${e.message}`);
  }
}

// ─── Claude Code SessionStart hook (no shell alias needed) ───

const SETTINGS_FILE = join(HOME, ".claude", "settings.json");

function readSettings() {
  try { return JSON.parse(readFileSync(SETTINGS_FILE, "utf-8")); } catch { return {}; }
}

function writeSettings(settings) {
  atomicWrite(SETTINGS_FILE, JSON.stringify(settings, null, 2) + "\n");
}

function installHook(scriptPath) {
  const settings = readSettings();
  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.SessionStart) settings.hooks.SessionStart = [];

  const cmd = `node "${scriptPath}" --auto --quiet 2>/dev/null || true`;

  const existing = settings.hooks.SessionStart.find(g =>
    g.hooks?.some(h => h.command?.includes("choose-buddy"))
  );
  if (existing) {
    existing.hooks[0].command = cmd;
  } else {
    settings.hooks.SessionStart.push({
      hooks: [{
        type: "command",
        command: cmd,
        timeout: 60,
      }]
    });
  }

  writeSettings(settings);
}

function removeHook() {
  const settings = readSettings();
  if (!settings.hooks?.SessionStart) return;
  settings.hooks.SessionStart = settings.hooks.SessionStart.filter(g =>
    !g.hooks?.some(h => h.command?.includes("choose-buddy"))
  );
  if (settings.hooks.SessionStart.length === 0) delete settings.hooks.SessionStart;
  if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
  writeSettings(settings);
}

// ─── CLI ───

const args = process.argv.slice(2);

if (args.includes("--help") || args.length === 0) {
  console.log(`
choose-buddy — pick your Claude Code companion species

Usage:
  node choose-buddy.mjs <species>                     Pick a species
  node choose-buddy.mjs <species> --rarity <rarity>   Pick species + exact rarity
  node choose-buddy.mjs <species> --persist            Pick + auto-repatch on updates
  node choose-buddy.mjs --list                        List all species
  node choose-buddy.mjs --info                        Show current companion
  node choose-buddy.mjs --restore                     Undo everything

Species: ${SPECIES.join(", ")}
Rarities: ${RARITIES.join(", ")}
`);
  process.exit(0);
}

if (args.includes("--list")) {
  console.log("Available species:");
  for (const s of SPECIES) console.log(`  ${s}`);
  process.exit(0);
}

if (args.includes("--info")) {
  try {
    const config = readConfig();
    const userId = getUserId(config);
    const current = rollFull(userId, ORIGINAL_SALT);
    const stored = config.companion;
    console.log("Current companion:");
    if (stored) {
      console.log(`  Name: ${stored.name}`);
      console.log(`  Personality: ${stored.personality}`);
    } else {
      console.log("  (not hatched yet)");
    }
    console.log(`  Species: ${current.species} (${current.rarity})`);
    console.log(`  Eye: ${current.eye}  Hat: ${current.hat}  Shiny: ${current.shiny}`);
    console.log(`  Stats: ${STAT_NAMES.map(n => `${n}:${current.stats[n]}`).join(" ")}`);
    const choice = loadChoice();
    if (choice?.species) console.log(`  Saved choice: ${choice.species}${choice.rarity ? ` (${choice.rarity})` : ""}`);
  } catch (e) {
    console.error(`Cannot read companion info: ${e.message}`);
    process.exit(1);
  }
  process.exit(0);
}

if (args.includes("--auto")) {
  applyChoice(args.includes("--quiet") || args.includes("-q"));
  process.exit(0);
}

if (args.includes("--restore")) {
  const binaryPath = getBinaryPath();
  if (!binaryPath) { console.error("Could not find claude binary"); process.exit(1); }
  const backupPath = binaryPath + ".original";
  if (!existsSync(backupPath)) {
    console.error("No backup found. Nothing to restore.");
    process.exit(1);
  }
  try {
    const tmpPath = `${binaryPath}.restoring.${process.pid}`;
    copyFileSync(backupPath, tmpPath);
    chmodSync(tmpPath, statSync(backupPath).mode);
    renameSync(tmpPath, binaryPath);
  } catch (e) {
    console.error(`Restore failed: ${e.message}`);
    process.exit(1);
  }
  try { unlinkSync(backupPath); } catch {}
  try {
    const config = readConfig();
    delete config.companion;
    writeConfig(config);
  } catch {}
  clearChoice();
  removeHook();
  console.log("Restored. Restart Claude Code to re-hatch your original companion.");
  process.exit(0);
}

// Main: choose a species
const targetSpecies = args[0]?.toLowerCase();
if (!SPECIES.includes(targetSpecies)) {
  console.error(`Unknown species: "${targetSpecies}"\nAvailable: ${SPECIES.join(", ")}`);
  process.exit(1);
}

const rarityIdx = args.indexOf("--rarity");
const targetRarity = rarityIdx !== -1 ? args[rarityIdx + 1]?.toLowerCase() : null;
if (targetRarity && !RARITIES.includes(targetRarity)) {
  console.error(`Unknown rarity: "${targetRarity}"\nAvailable: ${RARITIES.join(", ")}`);
  process.exit(1);
}

try {
  const config = readConfig();
  const userId = getUserId(config);
  const binaryPath = getBinaryPath();

  if (!binaryPath) {
    console.error("Could not find claude binary. Is Claude Code installed?");
    process.exit(1);
  }

  console.log(`Finding best salt for ${targetSpecies}${targetRarity ? ` (${targetRarity})` : ""}...`);

  const result = findBestSalt(userId, targetSpecies, targetRarity);

  if (!result) {
    console.error(`Could not find a salt for ${targetSpecies}${targetRarity ? ` ${targetRarity}` : ""} in 500k attempts`);
    process.exit(1);
  }

  console.log(`Found: ${result.rarity} ${result.species} (eye=${result.eye} hat=${result.hat} shiny=${result.shiny})`);
  console.log(`Stats: ${STAT_NAMES.map(n => `${n}:${result.stats[n]}`).join(" ")}`);
  console.log();

  console.log(`Patching ${binaryPath}...`);
  const count = patchBinary(binaryPath, result.salt);
  console.log(`Patched ${count} locations.`);

  const scriptPath = realpathSync(process.argv[1]);
  saveChoice(targetSpecies, targetRarity, scriptPath);

  if (args.includes("--persist")) {
    installHook(scriptPath);
    console.log("SessionStart hook installed. Your choice will persist across Claude Code updates.");
  }

  delete config.companion;
  writeConfig(config);

  console.log();
  console.log("Done! Restart Claude Code and run /buddy to meet your new companion.");
  if (!args.includes("--persist")) {
    console.log("Tip: re-run with --persist to survive Claude Code updates automatically.");
  }
  console.log("Run with --restore to undo everything.");
} catch (e) {
  console.error(`Failed: ${e.message}`);
  process.exit(1);
}
