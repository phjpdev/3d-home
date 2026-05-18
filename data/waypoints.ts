import * as THREE from "three";

export type WaypointNeighbor = {
  to: string;
  label?: string;
};

export type ResolvedWaypoint = {
  id: string;
  position: THREE.Vector3;
  neighbors: WaypointNeighbor[];
  defaultYawDeg: number;
};
