import type { CapabilitySimulationRowDTO } from "../types";

export const verifications = ["none", "email", "phone", "dual"] as const;

export function groupPermissionRows(rows: CapabilitySimulationRowDTO[], vip: boolean) {
  const levels = new Map<number, CapabilitySimulationRowDTO[]>();
  for (const row of rows) {
    if (row.permanent_vip !== vip) continue;
    const group = levels.get(row.growth_level) ?? [];
    group.push(row);
    levels.set(row.growth_level, group);
  }
  const ranges: { from: number; through: number; cells: (CapabilitySimulationRowDTO | undefined)[]; signature: string }[] = [];
  for (const [level, group] of [...levels].sort(([a], [b]) => a - b)) {
    const cells = verifications.map((state) => group.find((row) => row.verification === state));
    const signature = JSON.stringify(cells.map((row) => row && [row.allowed, row.failed, row.denied_by, row.limits]));
    const previous = ranges[ranges.length - 1];
    if (previous && previous.through + 1 === level && previous.signature === signature) previous.through = level;
    else ranges.push({ from: level, through: level, cells, signature });
  }
  return ranges;
}
