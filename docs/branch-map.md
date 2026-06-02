# Branch Map v1

## Nodes

| ID | Type | Name | Duration | Purpose |
| --- | --- | --- | --- | --- |
| A0 | Film | Rain Signal | 35s | Introduce city, protagonist, target convoy |
| I1 | Play | Car Chase | 25s | Player controls speed and lane stability |
| C1 | Film | Clean Pursuit | 20s | Perfect chase, strong competence fantasy |
| C2 | Film | Damaged Pursuit | 20s | Success with cost |
| C3 | Film | Lost Trail | 25s | Regret, delayed arrival |
| A2 | Film | Warehouse Threshold | 35s | Boss setup and evidence upload threat |
| I2 | Play | Boss Interrupt | 30s | Player balances fighting and stopping upload |
| E1 | Ending | Before the Breakpoint | 35s | Best ending |
| E2 | Ending | A Lit Wound | 35s | Costly victory |
| E3 | Ending | The City Believes the Screen | 40s | Regret ending |

## Driving Score

```text
drive_score = speed_control * 0.35
            + lane_stability * 0.35
            + reaction * 0.20
            + risk * 0.10
```

Results:

```text
85-100 -> C1
55-84  -> C2
0-54   -> C3
```

## Combat Score

Metrics:

```text
timing
terminal_damage
health
evidence_integrity
```

Results:

```text
timing >= 80 and terminal_damage >= 80 and evidence_integrity >= 70 -> E1
health > 0 and evidence_integrity >= 40                             -> E2
otherwise                                                           -> E3
```

## Prototype Simplification

The first web demo uses stylized interactive panels instead of real generated videos:

- Film nodes use the key art plus animated overlays.
- I1 is a lane-dodge timing game.
- I2 is a timing-and-priority meter game.
- Branches are immediately visible, so we can test whether the structure feels satisfying.

