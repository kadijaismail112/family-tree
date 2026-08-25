import type { Galaxy, GalaxyNode } from "@/lib/beta/galaxy";

/**
 * TRIAL 2 · The camera.
 *
 * Perspective is done here in plain arithmetic rather than handed to a CSS
 * 3D transform, because the connecting lines have to land in exactly the same
 * places as the faces do. A CSS transform would carry the cards and leave the
 * SVG behind; projecting both from one function keeps them honest.
 */

/** how far the eye sits from the plane it is focused on */
export const FOCAL = 1000;

export interface Camera {
  x: number;
  y: number;
  z: number;
  zoom: number;
  /** a slow swing around the vertical, purely for parallax */
  yaw: number;
}

export interface Projected {
  personId: string;
  /** where it lands on screen, in pixels from the top left */
  sx: number;
  sy: number;
  /** perspective scale — 1 at the focal plane, smaller further back */
  scale: number;
  /** distance behind the focal plane, in world units; negative is in front */
  depth: number;
  node: GalaxyNode;
}

export function project(
  node: GalaxyNode,
  cam: Camera,
  viewW: number,
  viewH: number
): Projected {
  // swing the world around the camera before flattening it
  const dx = node.x - cam.x;
  const dz = node.z - cam.z;
  const cos = Math.cos(cam.yaw);
  const sin = Math.sin(cam.yaw);
  const rx = dx * cos - dz * sin;
  const rz = dx * sin + dz * cos;

  const denom = Math.max(FOCAL + rz, 1); // never divide through zero at the eye
  const scale = (FOCAL / denom) * cam.zoom;

  return {
    personId: node.personId,
    sx: rx * scale + viewW / 2,
    sy: (node.y - cam.y) * scale + viewH / 2,
    scale,
    depth: rz,
    node,
  };
}

export function projectAll(
  galaxy: Galaxy,
  cam: Camera,
  viewW: number,
  viewH: number
): Map<string, Projected> {
  const out = new Map<string, Projected>();
  for (const node of Array.from(galaxy.nodes.values())) {
    out.set(node.personId, project(node, cam, viewW, viewH));
  }
  return out;
}

/**
 * How present something is: 1 for whatever you came to look at, falling away
 * with distance behind the focal plane. Nothing ever reaches zero — the point
 * of the canvas is that the rest of the family stays visible while you read
 * one part of it.
 */
export function presence(depth: number, inBand: boolean): number {
  const behind = Math.abs(depth);
  const byDepth = Math.max(0.16, 1 - behind / 1600);
  // Being in the band lifts someone clear of the background, but it does not
  // flatten them onto the focal plane: a relative on another bloodline should
  // still read as over there, or the canvas loses its depth entirely.
  return inBand ? Math.max(byDepth, 0.55) : byDepth * 0.5;
}

/** blur in pixels, so the far islands read as far rather than as small */
export function haze(depth: number, inBand: boolean): number {
  const behind = Math.abs(depth);
  if (behind < 40) return 0; // the plane you are reading stays crisp
  return Math.min(inBand ? 1.8 : 5, behind / (inBand ? 900 : 380));
}
