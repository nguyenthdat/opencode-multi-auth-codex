# GPT-5.4 Fast Benchmark

> Historical point-in-time benchmark. It predates the current GPT-5.6 model
> guidance and is not current release validation. Original package version,
> commit, run count, and environment were not recorded, so treat the numbers as
> directional only.

This benchmark was run against OpenCode using the multi-auth Codex plugin in a real repository, with continued-session prompts that read files, analyze code, and reuse the same session across multiple turns.

## Summary Table

| Mode                | Avg Time to First Text | Avg Time to Complete | Total Tokens/sec | Output Tokens/sec | Reasoning Tokens/sec | Completed Turns/min | Notes                            |
| ------------------- | ---------------------: | -------------------: | ---------------: | ----------------: | -------------------: | ------------------: | -------------------------------- |
| GPT-5.4 Medium      |                 12.85s |               12.92s |            8,361 |              37.7 |                  3.5 |                4.87 | Baseline                         |
| GPT-5.4 Medium Fast |                 12.01s |               12.10s |            8,594 |              40.1 |                  4.4 |                5.01 | 6.4% faster overall              |
| GPT-5.4 High        |                 57.10s |               57.21s |            4,645 |              23.3 |                  7.4 |                1.27 | Baseline                         |
| GPT-5.4 High Fast   |                 63.65s |               63.72s |            6,629 |              37.0 |                 12.9 |                1.75 | Higher throughput, mixed latency |
| GPT-5.4 XHigh       |                 88.48s |               88.56s |            2,836 |              22.8 |                 13.6 |                0.88 | Baseline                         |
| GPT-5.4 XHigh Fast  |                 69.45s |               69.55s |            3,540 |              32.5 |                 20.0 |                1.10 | 21.5% faster overall             |

## Headline Results

- `XHigh Fast` reduced end-to-end continued-session latency by `21.5%`.
- `XHigh Fast` increased throughput by:
  - `+24.8%` total tokens/sec
  - `+42.7%` output tokens/sec
  - `+47.2%` reasoning tokens/sec
- `Medium Fast` delivered a smaller but consistent `6.4%` latency improvement.
- `High Fast` improved throughput significantly, but did not produce stable latency gains.

## Methodology

- Same repository
- Same prompt sequence
- Same continued-session flow
- Real file reads and tool usage
- Metrics taken from live OpenCode runs

This benchmark is intended to capture realistic coding-session behavior, not cold-start single-turn chat latency.
