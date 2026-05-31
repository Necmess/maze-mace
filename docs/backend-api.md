# Backend API Draft

This project is currently a client-only game. The contracts below are the first server boundary for persistent runs, leaderboard, and remotely managed balance config.

## Data Model

`RunResult`

```ts
{
  runId: string;
  build: 'breaker' | 'striker' | 'cartographer' | 'guardian';
  stats: {
    score: number;
    kills: number;
    roomsExpanded: number;
    maxCombo: number;
    contamination: number;
    survivalTime: number;
  };
  upgrades: UpgradeOption[];
  rank: 'SSS' | 'SS' | 'S' | 'A' | 'B' | 'C' | 'D';
  isNewRecord: boolean;
  startedAt: string;
  endedAt: string;
  clientVersion: string;
}
```

## Endpoints

### `POST /runs`

Submit a completed run.

Request body:

```json
{
  "build": "breaker",
  "stats": {
    "score": 6840,
    "kills": 17,
    "roomsExpanded": 8,
    "maxCombo": 9,
    "contamination": 62,
    "survivalTime": 392
  },
  "upgrades": ["heavy_impact", "maze_sense"],
  "clientVersion": "0.0.0"
}
```

Response body:

```json
{
  "runId": "run_01J...",
  "rank": "SSS",
  "isNewRecord": true,
  "records": {}
}
```

Server responsibilities:

- Validate numeric ranges for stats.
- Recompute rank from score.
- Update user/build records.
- Optionally reject impossible runs once event logs are available.

### `GET /leaderboard`

Return ranked runs.

Query params:

- `build`: optional build filter.
- `period`: `daily`, `weekly`, `all`.
- `limit`: default `50`, max `100`.

### `GET /config`

Return server-controlled balance config.

Response body should match `GameConfig` from `src/config/gameConfig.ts`.

## Future Anti-Cheat Boundary

For trusted leaderboards, send a compact run event log instead of only final stats:

- room expansion events
- enemy kill events
- upgrade selections
- score gain events
- damage taken events
- timestamps or frame counters

The server can then replay or sanity-check the run against `gameConfig`.
