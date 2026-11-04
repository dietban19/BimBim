# California corner framing

The framing view uses the insulated three-stud California corner shown in
[APA detail DT-AF-2](https://www.apawood.org/guides-tools-training/technical-document-library/typical-details/insulated-three-stud-corner-california-corner/).
Two end studs belong to the intersecting walls; a third stud turns flat against
the through wall's interior face. This forms an L with its end stud, provides
backing past the butt wall's inside face, and leaves the corner cavity open for
insulation. Two-stud corners with clips or ladder backing are separate details.

## Geometry

Walls are drawn centreline to centreline. The existing junction solver keeps
the X wall as the through wall and the Z wall as the butt wall. Framing now
gets explicit per-end metadata from `resolveFramingCorners`: role, interior
side, and adjoining wall thickness. Offset signs do not identify topology.
Only a perpendicular pair sharing centreline endpoints qualifies. Continuous
T-junctions, split T-junctions, and disconnected ends get no California detail.

For a through-wall end, let `s` be stud thickness (0.038 m), `D` be through-wall
depth, `B` be butt-wall depth, and `E` be the built outside end coordinate:

| Member | Length along through wall | Depth across through wall | Placement |
| --- | --- | --- | --- |
| End stud | `s` | `D` | Flush with `E` |
| Turned backing stud | `B` | `s` | Immediately inward from the end stud, flush with the interior face |
| Butt-wall end stud | `s` along the butt wall | `B` | Flush with the through wall's interior face |

The turned stud starts one stud thickness inward from `E` and ends at
`B + s` inward from `E`. It therefore exposes `s` of backing beyond the butt
wall's inside face. For equal wall depths it has the same cross-section as
the other studs, rotated 90 degrees. For unequal depths its breadth follows
the adjoining wall so that the backing still reaches that inside face.

`buildWallFraming` produces the exact member dimensions and local positions
used by both Three.js and the framing elevation. Layout stations remain at
16 inches O.C. from the local left end-stud centre; stations overlapping either
corner assembly are omitted. The elevation uses built length, actual projected
member widths, and face-to-face clearances.

The wall mesh retains its existing +90-degree Y rotation for Z walls. This
means local left is the high-Z end; corner metadata is mapped accordingly.
Changes to the adjoining wall's side or thickness rebuild framing even if
the wall's endpoint offsets stay unchanged.

## Scope

This is a geometric framing detail, not a structural or fastener design.
Wall thickness continues to represent framing depth, including the editor's
existing defaults. Finish layers, opening/header framing, plate laps,
T-junction backing, non-orthogonal corners, and clip-supported two-stud corners
are outside this change. If a wall is too short to fit a backing stud without
overlap, or thinner than the backing stud, that stud is omitted; such walls do
not represent a complete California corner. Corner and regular studs are never
forced into overlapping positions to make the drawing fit.

## Verification

Run `npm test` and `npm run build`. Corner tests cover all four quadrants,
both endpoint directions on each wall, input order, unequal depths, world-space
member intersections, interior backing exposure, T-junctions, short walls,
and a neighbour moving to the other side or being removed.

To inspect manually, draw an X wall and Z wall from a shared endpoint, then
show framing for both. The X wall should have one flat backing stud at the
interior corner, with the Z wall's end stud touching its interior face. Repeat
with the Z wall on the other side, and inspect the O.C. elevation: the backing
stud should appear broad, and its clear dimensions should match its faces.
