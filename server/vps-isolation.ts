import type { VpsComputerStatus } from "./vps-computer.ts";

export const VPS_CONTAINER_LABEL = "com.openmausbot.container";
export const VPS_ENVIRONMENT_LABEL = "com.openmausbot.environment";

export function homeVolume(alias: string | undefined, name: string): string | null {
  return alias && process.env.OMB_VPS_PERSISTENT_HOME === `${alias}/${name}` ? `${name}-home` : null;
}

export async function verifyHomeVolume(name: string, volume: string, environmentId: string, run: (args: string[]) => Promise<{ stdout: string }>) {
  const [detail] = JSON.parse((await run(["volume", "inspect", volume])).stdout);
  if (detail?.Name !== volume || detail.Driver !== "local" || Object.keys(detail.Options ?? {}).length ||
      detail.Labels?.[VPS_CONTAINER_LABEL] !== name || detail.Labels?.[VPS_ENVIRONMENT_LABEL] !== environmentId) {
    throw new Error("The VPS home volume has unexpected ownership, driver or options");
  }
}

export function vpsMounts(detail: {
  Mounts?: unknown;
  HostConfig?: { Binds?: string[] | null; VolumesFrom?: string[] | null };
}, volume: string | null): VpsComputerStatus["mounts"] {
  if (!Array.isArray(detail.Mounts) || detail.HostConfig?.Binds?.length || detail.HostConfig?.VolumesFrom?.length) return "unsafe";
  if (!volume) return detail.Mounts.length === 0 ? "none" : "unsafe";
  const [m] = detail.Mounts;
  return detail.Mounts.length === 1 && m?.Type === "volume" && m.Name === volume && m.Driver === "local" &&
    m.Destination === "/home/cua" && m.RW === true ? "home" : "unsafe";
}

export function vpsMountsAllowed(mounts: VpsComputerStatus["mounts"]): boolean {
  return mounts === "none" || mounts === "home";
}

export function hasNoPublishedPorts(config: {
  NetworkMode?: string;
  PortBindings?: Record<string, unknown> | null;
  PublishAllPorts?: boolean;
} | undefined, networks?: Record<string, unknown> | null): boolean {
  if (!config) return false;
  const networkMode = (config.NetworkMode ?? "").toLowerCase();
  if (!["default", "bridge"].includes(networkMode)) return false;
  const attached = Object.keys(networks ?? {}).map((name) => name.toLowerCase());
  if (attached.length !== 1 || !["default", "bridge"].includes(attached[0]!)) return false;
  return (
    config.PublishAllPorts !== true &&
    !Object.values(config.PortBindings ?? {}).some((value) => Array.isArray(value) && value.length > 0)
  );
}
