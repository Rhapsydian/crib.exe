/**
 * Merge rank III's Process bonus (session 66, docs/subroutines-design.md
 * S4): rank III adds this share of the Process's base amount (a growing
 * Process with no base: of its growth cap), on top of the Hook bump every
 * rank gives. Authored per subroutine within 50-150%: weaker or
 * situational Processes higher (~150% for 1-point, Tempo or Charge ones,
 * ~100% typical, ~50% big), rarer subroutines higher. TBD/measured.
 */
export const RANK_THREE_PROCESS_SHARE: Record<string, number> = {
  'buffer-overflow': 1.5, // Buffer Overflow (common): credit 1
  'port-scan': 1.5, // Port Scan (common): credit 1
  'fuzzer': 1, // Fuzzer (common): credit 2
  'doorknob-rattle': 1.5, // Doorknob Rattle (common): credit 1
  'credential-stuffing': 1.5, // Credential Stuffing (uncommon): credit 1
  'jackpot': 1, // Jackpot (uncommon): credit 2
  'man-in-the-middle': 1, // Man in the Middle (uncommon): credit 2
  'zero-day-chain': 1.25, // Zero-Day Chain (rare): credit 2
  'race-condition': 1.5, // Race Condition (rare): credit 1
  'cron-job': 1.5, // Cron Job (common): credit 1 growing to 3
  'watchdog-timer': 1.5, // Watchdog Timer (common): suppress 1
  'steady-drip': 1.5, // Steady Drip (common): credit 1 growing to 2
  'patch': 1.5, // Patch (common): suppress 1 growing to 2
  'memory-leak': 0.5, // Memory Leak (uncommon): credit 0 growing to 3
  'heartbeat-monitor': 1.5, // Heartbeat Monitor (uncommon): suppress 1
  'failover': 1.5, // Failover (uncommon): credit 1
  'load-balancer': 1.25, // Load Balancer (rare): credit 2
  'fork-bomb': 1.5, // Fork Bomb (rare): credit 1 growing to 3
  'ping': 1.5, // Ping (common): credit 1
  'cache-hit': 1, // Cache Hit (common): empower 1 (the user: 100%, as Empower 2.5 strengthened the next subroutine too much)
  'burst-clock': 1.5, // Burst Clock (common): credit 1
  'elevated-session': 1.5, // Elevated Session (common): credit 1
  'priority-override': 1.5, // Priority Override (uncommon): credit 1
  'port-forward': 1.5, // Port Forward (uncommon): credit 1
  'grand-slam': 1.5, // Grand Slam (uncommon): credit 1
  'chain-reaction': 1.25, // Chain Reaction (rare): credit 2
  'turbo-mode': 1.5, // Turbo Mode (rare): tempo 0.041666666666666664
  'tarpit': 1, // Tarpit (common): ward 2
  'honeytoken': 1.5, // Honeytoken (common): credit 1
  'basic-auth': 1, // Basic Auth (common): ward 2
  'rate-limiting': 1.5, // Rate Limiting (common): credit 1
  'sinkhole': 1, // Sinkhole (uncommon): ward 2
  'fail2ban': 1.5, // Fail2Ban (uncommon): credit 1
  'deep-packet-inspection': 1.5, // Deep Packet Inspection (uncommon): ward 1
  'zero-trust': 1.5, // Zero Trust (rare): ward 1
  'air-gapped-vault': 1.25, // Air-Gapped Vault (rare): credit 2
};

/** A subroutine with no authored share (none should be missing). */
export const RANK_THREE_DEFAULT_SHARE = 1;
