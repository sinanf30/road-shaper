import type { Vec2 } from "./geometry";

export type RoadType = "land" | "haupt" | "autobahn" | "rampe";

export interface RoadSpec {
  id: RoadType;
  label: string;
  lanes: number;
  maxLanes: number;
  speed: number;
  costPerMeter: number;
  laneWidth: number;
  asphalt: string;
  edge: string;
  minRadius: number;
  markings: "dashed" | "solid" | "highway";
}

export const ROAD_SPECS: Record<RoadType, RoadSpec> = {
  land: {
    id: "land",
    label: "Landstraße",
    lanes: 1,
    maxLanes: 2,
    speed: 70,
    costPerMeter: 55,
    laneWidth: 3.6,
    asphalt: "#4a4742",
    edge: "#6b6459",
    minRadius: 14,
    markings: "dashed",
  },
  haupt: {
    id: "haupt",
    label: "Hauptstraße",
    lanes: 2,
    maxLanes: 3,
    speed: 50,
    costPerMeter: 110,
    laneWidth: 3.4,
    asphalt: "#464340",
    edge: "#6e675c",
    minRadius: 12,
    markings: "solid",
  },
  autobahn: {
    id: "autobahn",
    label: "Autobahn",
    lanes: 3,
    maxLanes: 4,
    speed: 120,
    costPerMeter: 240,
    laneWidth: 3.75,
    asphalt: "#403d3a",
    edge: "#736b5f",
    minRadius: 45,
    markings: "highway",
  },
  rampe: {
    id: "rampe",
    label: "Rampe / Auffahrt",
    lanes: 1,
    maxLanes: 2,
    speed: 60,
    costPerMeter: 140,
    laneWidth: 3.5,
    asphalt: "#454240",
    edge: "#6f6858",
    minRadius: 18,
    markings: "solid",
  },
};

export type VehicleKind = "car" | "truck" | "bus" | "van" | "moto" | "emergency";

export interface VehicleSpec {
  kind: VehicleKind;
  label: string;
  length: number;
  width: number;
  accel: number;
  brake: number;
  speedFactor: number;
  color: string[];
  share: number;
}

export const VEHICLE_SPECS: Record<VehicleKind, VehicleSpec> = {
  car: {
    kind: "car",
    label: "PKW",
    length: 4.4,
    width: 1.8,
    accel: 2.6,
    brake: 4.5,
    speedFactor: 1,
    color: ["#c8c3b8", "#8d9aa6", "#a14b3c", "#3f5a52", "#d8d2c4", "#5b6470"],
    share: 0.7,
  },
  van: {
    kind: "van",
    label: "Lieferwagen",
    length: 5.6,
    width: 2,
    accel: 2,
    brake: 4,
    speedFactor: 0.92,
    color: ["#dcd8cd", "#b9b3a4", "#7d8a93"],
    share: 0.1,
  },
  truck: {
    kind: "truck",
    label: "LKW",
    length: 11.5,
    width: 2.5,
    accel: 1.1,
    brake: 3.2,
    speedFactor: 0.78,
    color: ["#6e7b83", "#8a6a4e", "#4f5a52"],
    share: 0.1,
  },
  bus: {
    kind: "bus",
    label: "Bus",
    length: 12,
    width: 2.55,
    accel: 1.3,
    brake: 3.5,
    speedFactor: 0.8,
    color: ["#b5762f", "#3e6b7a"],
    share: 0.05,
  },
  moto: {
    kind: "moto",
    label: "Motorrad",
    length: 2.2,
    width: 0.9,
    accel: 3.6,
    brake: 5,
    speedFactor: 1.08,
    color: ["#2f2f31", "#8f2f2f"],
    share: 0.04,
  },
  emergency: {
    kind: "emergency",
    label: "Einsatzfahrzeug",
    length: 6,
    width: 2.2,
    accel: 3,
    brake: 5,
    speedFactor: 1.2,
    color: ["#d94f3d"],
    share: 0.01,
  },
};

export type DriverStyle = "calm" | "normal" | "aggressive";

export interface Node {
  id: string;
  pos: Vec2;
  level: number;
  control: "none" | "yield" | "stop" | "signal" | "roundabout";
  signal?: SignalConfig;
  roundabout?: { radius: number; lanes: number };
  crosswalk: boolean;
  label?: string;
  labelKind?: "exit" | "entry" | "dest";
}

export interface SignalPhase {
  /** Edge ids that get green in this phase. */
  edges: string[];
  green: number;
}

export interface SignalConfig {
  phases: SignalPhase[];
  index: number;
  timer: number;
  amber: number;
  adaptive: boolean;
  offset: number;
}

export interface Edge {
  id: string;
  from: string;
  to: string;
  pts: Vec2[];
  cum: number[];
  length: number;
  type: RoadType;
  lanesFwd: number;
  lanesBwd: number;
  oneWay: boolean;
  speed: number;
  level: number;
  trees: boolean;
  sidewalk: boolean;
  bus: boolean;
  blocked: number; // seconds of blockage remaining (incident)
  name?: string;
  /** rolling stats */
  stat: { flow: number; speedSum: number; speedN: number; load: number };
}

export interface ParkingLot {
  id: string;
  pos: Vec2;
  angle: number;
  rows: number;
  cols: number;
  edgeId: string | null;
  occupied: number;
  name: string;
}

export interface Sign {
  id: string;
  pos: Vec2;
  kind: "exit" | "entry" | "dest" | "speed" | "stop" | "yield";
  text: string;
  value?: number;
}

export interface Tree {
  pos: Vec2;
  r: number;
  kind: number;
}

export interface Vehicle {
  id: number;
  kind: VehicleKind;
  style: DriverStyle;
  color: string;
  edgeId: string;
  dir: 1 | -1;
  lane: number;
  s: number;
  speed: number;
  route: string[];
  routeIdx: number;
  destNode: string;
  originNode: string;
  wait: number;
  totalWait: number;
  age: number;
  laneOffset: number;
  targetLane: number;
  parkingId: string | null;
  parkTimer: number;
  state: "drive" | "parking" | "parked" | "leaving";
  reroutes: number;
  pos: Vec2;
  heading: number;
  braking: boolean;
}

export interface Incident {
  id: string;
  edgeId: string;
  s: number;
  kind: "accident" | "works";
  remaining: number;
}
