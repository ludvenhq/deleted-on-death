# Changelog

All notable changes to Deleted on Death are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). A change to a rule or a default number
is a notable change.

## [Unreleased]

### Added

- The rules: a death in the Overworld deletes the block under the body (or the nearest pool block
  below it, or a random one) from a pool of 200 natural and common blocks; deleted blocks are
  purged from the world around every player as a wave, nearest chunk first, within 10 ms of each
  tick; they cannot be placed, carried or formed by lava and water; regrowers are swept again
  every minute; `SAFE HERE` outside the Overworld and `NOTHING LEFT` once the pool is gone.
- The BLOCKS LEFT boss bar, the death title and sounds, and the shatter when the wave reaches a
  respawned player.
- `/deleted add`, `random`, `list`, `purge`, `reset`, `stats` and `spike` for testing, filming and
  measuring the purge.
- The build pipeline, docs and checks, from the Diamond Threat scaffold, and the 1.21.1 block list
  the pool is tested against.
