import * as THREE from 'three';
import {
  DEFAULT_DOOR_HEIGHT,
  DEFAULT_DOOR_WIDTH,
  DEFAULT_WINDOW_BOTTOM,
  DEFAULT_WINDOW_HEIGHT,
  DEFAULT_WINDOW_WIDTH,
  OPENING_HEIGHT_LIMITS,
  OPENING_TYPE_LABELS,
  OPENING_WIDTH_LIMITS,
  SILL_HEIGHT_LIMITS,
} from '../model/openingDimensions';
import type { DimensionResult, OpeningKind, OpeningSummary, OpeningType } from '../types/editor';
import { validateDimension } from '../utils/validation';
import { BaseMesh } from './BaseMesh';
import { DOOR_STYLES, WINDOW_STYLES, type VisualState } from './visualStyle';
import type { WallMesh } from './WallMesh';

// Detail mesh colors (each builder creates its own material instances)
const DOOR_FRAME_COL  = 0xd4c8b4;
const DOOR_PANEL_COL  = 0xb08a52;
const DOOR_TRIM_COL   = 0x8c6c38;
const DOOR_KNOB_COL   = 0xc89040;
const WIN_FRAME_COL   = 0xeae8e0;
const WIN_GLASS_COL   = 0x90c8e0;
const WIN_MULLION_COL = 0xe0ddd4;

export interface OpeningMeshOptions {
  readonly kind: OpeningKind;
  readonly type: OpeningType;
  readonly wallId: string;
  readonly offsetT: number;
  readonly width?: number;
  readonly height?: number;
  readonly bottomHeight?: number;
  readonly preview?: boolean;
}

/**
 * A door or window opening embedded in a WallMesh. Must be added as a child of
 * its wall so it inherits the wall's world transform. Call syncToWall() after
 * placement and whenever the host wall's dimensions change.
 */
export class OpeningMesh extends BaseMesh {
  readonly openingType: OpeningType;
  readonly wallId: string;
  readonly isPreview: boolean;

  private offsetT: number;
  private openingWidth: number;
  private openingHeight: number;
  private openingBottomHeight: number;

  private readonly edges: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>;
  private readonly detailGroup = new THREE.Group();

  constructor(options: OpeningMeshOptions) {
    const { kind, type } = options;
    const label = OPENING_TYPE_LABELS[type];
    super(kind, label, options.preview ? `${kind}-preview` : kind);

    this.openingType = type;
    this.wallId = options.wallId;
    this.isPreview = options.preview ?? false;
    this.offsetT = Math.max(0, Math.min(1, options.offsetT));
    this.openingWidth = options.width ?? (kind === 'door' ? DEFAULT_DOOR_WIDTH : DEFAULT_WINDOW_WIDTH);
    this.openingHeight = options.height ?? (kind === 'door' ? DEFAULT_DOOR_HEIGHT : DEFAULT_WINDOW_HEIGHT);
    this.openingBottomHeight = options.bottomHeight ?? (kind === 'door' ? 0 : DEFAULT_WINDOW_BOTTOM);

    // Render the background box on top of wall faces
    this.material.polygonOffset = true;
    this.material.polygonOffsetFactor = -1;
    this.material.polygonOffsetUnits = -1;

    this.edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(),
      new THREE.LineBasicMaterial(),
    );
    this.edges.name = 'opening-outline';
    this.add(this.edges);
    this.add(this.detailGroup);

    if (this.isPreview) this.name = `${label} preview`;
    this.refreshVisualState();
  }

  getOffsetT(): number { return this.offsetT; }
  getWidth(): number { return this.openingWidth; }
  getHeight(): number { return this.openingHeight; }
  getBottomHeight(): number { return this.openingBottomHeight; }

  setOffsetT(t: number): void {
    this.offsetT = Math.max(0, Math.min(1, t));
  }

  setWidth(width: number): DimensionResult {
    const result = validateDimension(width, OPENING_WIDTH_LIMITS);
    if (result.ok) this.openingWidth = result.value;
    return result;
  }

  setHeight(height: number): DimensionResult {
    const result = validateDimension(height, OPENING_HEIGHT_LIMITS);
    if (result.ok) this.openingHeight = result.value;
    return result;
  }

  setBottomHeight(h: number): DimensionResult {
    const result = validateDimension(h, SILL_HEIGHT_LIMITS);
    if (result.ok) this.openingBottomHeight = result.value;
    return result;
  }

  /**
   * Repositions and resizes the mesh within the wall's local coordinate space.
   * The wall box runs along local X, Y is up, Z is through the wall thickness.
   * Local Y=0 is at world Y = wallHeight/2 (the box is authored centred).
   *
   * Z-axis walls are rotated PI/2 around Y, mapping local +X to world -Z, so
   * we negate the offset for them so t=0 stays at the wall's draw-start end.
   */
  syncToWall(wall: WallMesh): void {
    const wallLength = wall.getLength();
    const wallHeight = wall.getHeight();
    const wallThickness = wall.getThickness();

    const maxWidth = Math.max(0.3, wallLength - 0.1);
    const actualWidth = Math.min(this.openingWidth, maxWidth);
    const halfW = (actualWidth / 2) / wallLength;
    const clampedT = Math.max(halfW, Math.min(1 - halfW, this.offsetT));

    const dirSign = wall.getOrientation() === 'z' ? -1 : 1;
    const localX = dirSign * (clampedT - 0.5) * wallLength;
    const localY = this.openingBottomHeight + this.openingHeight / 2 - wallHeight / 2;

    this.position.set(localX, localY, 0);

    const geo = new THREE.BoxGeometry(actualWidth, this.openingHeight, wallThickness + 0.02);
    this.replaceGeometry(geo);
    const prevEdges = this.edges.geometry;
    this.edges.geometry = new THREE.EdgesGeometry(geo);
    prevEdges.dispose();

    this.clearDetailGroup();
    if (!this.isPreview) {
      if (this.kind === 'door') {
        buildDoorDetails(this.detailGroup, actualWidth, this.openingHeight, wallThickness);
      } else {
        buildWindowDetails(this.detailGroup, actualWidth, this.openingHeight, wallThickness);
      }
    }

    this.updateMatrixWorld();
  }

  toSummary(): OpeningSummary {
    return {
      id: this.bimId,
      wallId: this.wallId,
      kind: this.kind as OpeningKind,
      type: this.openingType,
      offsetT: this.offsetT,
      width: this.openingWidth,
      height: this.openingHeight,
      bottomHeight: this.openingBottomHeight,
      name: this.name,
    };
  }

  protected override get visualState(): VisualState {
    return this.isPreview ? 'preview' : super.visualState;
  }

  protected override applyVisualState(state: VisualState): void {
    const styles = this.kind === 'door' ? DOOR_STYLES : WINDOW_STYLES;
    const style = styles[state];
    const translucent = style.opacity < 1;

    this.material.color.setHex(style.surface);
    this.material.opacity = style.opacity;
    this.material.transparent = translucent;
    this.material.depthWrite = !translucent;

    this.edges.material.color.setHex(style.edge);
    this.edges.material.transparent = translucent;
    this.edges.material.opacity = translucent ? Math.min(1, style.opacity * 1.4) : 1;
  }

  private clearDetailGroup(): void {
    const toDispose: (THREE.Mesh | THREE.LineSegments)[] = [];
    this.detailGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
        toDispose.push(obj);
      }
    });
    this.detailGroup.clear();
    for (const obj of toDispose) {
      obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) (m as THREE.Material).dispose();
    }
  }

  protected override disposeOwnedResources(): void {
    this.clearDetailGroup();
    this.edges.removeFromParent();
    this.edges.geometry.dispose();
    this.edges.material.dispose();
    this.edges.dispose();
  }
}

// ---- Door detail builder ------------------------------------------------

function buildDoorDetails(group: THREE.Group, w: number, h: number, wallT: number): void {
  const fw = Math.min(0.06, w * 0.09);  // casing/frame border width
  const iw = w - fw * 2;                 // inner panel width
  const ih = h - fw * 2;                 // inner panel height

  // Each successive layer has a slightly greater box depth, placing its front
  // and back faces geometrically in front of the previous layer — no polygon
  // offset needed beyond the main mesh.
  const dCasing = wallT + 0.04;
  const dPanel  = wallT + 0.06;
  const dTrim   = wallT + 0.065;

  const stdMat = (color: number, roughness = 0.85, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });

  // Casing: top rail, bottom rail, left stile, right stile.
  // Rails are full width; stiles span only the inner height to avoid corner overlap.
  group.add(mkMesh(new THREE.BoxGeometry(w,  fw, dCasing), stdMat(DOOR_FRAME_COL, 0.7), 0,              (h - fw) / 2, 0));
  group.add(mkMesh(new THREE.BoxGeometry(w,  fw, dCasing), stdMat(DOOR_FRAME_COL, 0.7), 0,             -(h - fw) / 2, 0));
  group.add(mkMesh(new THREE.BoxGeometry(fw, ih, dCasing), stdMat(DOOR_FRAME_COL, 0.7), -(w - fw) / 2, 0,             0));
  group.add(mkMesh(new THREE.BoxGeometry(fw, ih, dCasing), stdMat(DOOR_FRAME_COL, 0.7),  (w - fw) / 2, 0,             0));

  // Door leaf
  group.add(mkMesh(new THREE.BoxGeometry(iw, ih, dPanel), stdMat(DOOR_PANEL_COL, 0.9), 0, 0, 0));

  // Horizontal trim rail at centre giving a classic 2-panel look
  const trimH = Math.min(0.014, ih * 0.014);
  group.add(mkMesh(new THREE.BoxGeometry(iw * 0.86, trimH, dTrim), stdMat(DOOR_TRIM_COL, 0.9), 0, ih * 0.08,  0));
  group.add(mkMesh(new THREE.BoxGeometry(iw * 0.86, trimH, dTrim), stdMat(DOOR_TRIM_COL, 0.9), 0, -ih * 0.08, 0));

  // Door knob — placed on both faces so it's visible from either side
  const kr  = Math.min(0.028, iw * 0.038);
  const kx  = iw * 0.37;
  const ky  = -ih * 0.1;
  for (const kz of [-(wallT / 2 + 0.07), wallT / 2 + 0.07]) {
    group.add(mkMesh(
      new THREE.SphereGeometry(kr, 10, 10),
      stdMat(DOOR_KNOB_COL, 0.25, 0.65),
      kx, ky, kz,
    ));
  }
}

// ---- Window detail builder ---------------------------------------------

function buildWindowDetails(group: THREE.Group, w: number, h: number, wallT: number): void {
  const fw = Math.min(0.05, w * 0.08);  // frame width
  const iw = w - fw * 2;
  const ih = h - fw * 2;

  const dFrame   = wallT + 0.04;
  const dGlass   = wallT + 0.06;
  const dMullion = wallT + 0.065;

  const stdMat = (color: number) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0 });

  // Frame: top, bottom, left, right
  group.add(mkMesh(new THREE.BoxGeometry(w,  fw, dFrame), stdMat(WIN_FRAME_COL), 0,              (h - fw) / 2, 0));
  group.add(mkMesh(new THREE.BoxGeometry(w,  fw, dFrame), stdMat(WIN_FRAME_COL), 0,             -(h - fw) / 2, 0));
  group.add(mkMesh(new THREE.BoxGeometry(fw, ih, dFrame), stdMat(WIN_FRAME_COL), -(w - fw) / 2, 0,             0));
  group.add(mkMesh(new THREE.BoxGeometry(fw, ih, dFrame), stdMat(WIN_FRAME_COL),  (w - fw) / 2, 0,             0));

  // Glass pane — MeshBasicMaterial gives consistent transparency regardless of lighting
  group.add(mkMesh(
    new THREE.BoxGeometry(iw, ih, dGlass),
    new THREE.MeshBasicMaterial({ color: WIN_GLASS_COL, transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
    0, 0, 0,
  ));

  // Cross mullions (vertical + horizontal centre dividers)
  const mw = Math.min(0.022, iw * 0.025);
  group.add(mkMesh(new THREE.BoxGeometry(mw, ih, dMullion), stdMat(WIN_MULLION_COL), 0, 0, 0));
  group.add(mkMesh(new THREE.BoxGeometry(iw, mw, dMullion), stdMat(WIN_MULLION_COL), 0, 0, 0));
}

// ---- Shared utility ----------------------------------------------------

function mkMesh(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  return mesh;
}
