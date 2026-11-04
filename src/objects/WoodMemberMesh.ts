import * as THREE from 'three';

export class WoodMemberMesh extends THREE.Mesh<
  THREE.BoxGeometry,
  THREE.MeshStandardMaterial
> {
  private readonly outline: THREE.LineSegments<
    THREE.EdgesGeometry,
    THREE.LineBasicMaterial
  >;

  constructor(width: number, height: number, depth: number, color = 0xc99a63) {
    super(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.95,
        metalness: 0,
      }),
    );

    // Keep the surface slightly behind its outline.
    this.material.polygonOffset = true;
    this.material.polygonOffsetFactor = 1;
    this.material.polygonOffsetUnits = 1;

    // Outline this individual piece of wood.
    this.outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(this.geometry),
      new THREE.LineBasicMaterial({
        color: 0x65462e,
      }),
    );

    this.outline.name = 'wood-outline';
    this.add(this.outline);
  }

  override dispose(): void {
    this.removeFromParent();

    this.outline.removeFromParent();
    this.outline.geometry.dispose();
    this.outline.material.dispose();

    this.geometry.dispose();
    this.material.dispose();

    super.dispose();
  }
}
