import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildWallFraming } from '../model/wallFraming';
import { StudFramingPlan } from './StudFramingPlan';

describe('framing elevation', () => {
  it('draws the turned stud at its actual breadth and dimensions its clear faces', () => {
    const length = 2.4;
    const studs = buildWallFraming({ length, height: 2.4, depth: 0.1397,
      left: { role: 'through', interiorSide: 1, neighborThickness: 0.1397 } })
      .filter((m) => m.kind !== 'plate').sort((a, b) => a.x - b.x);
    const first = studs[0];
    if (!first) throw new Error('Missing end stud');
    const measurements = studs.map((m) => ({ name: m.name,
      ocIn: (m.x - first.x) / 0.0254, widthIn: m.width / 0.0254 }));
    const markup = renderToStaticMarkup(createElement(StudFramingPlan, { wallLength: length, measurements }));
    const projected = Array.from(markup.matchAll(/<rect\b[^>]*>/g)).map(([tag]) => {
      const attr = (name: string): number => Number(tag.match(new RegExp(` ${name}="([^"]+)"`))?.[1]);
      return { x: attr('x'), y: attr('y'), width: attr('width') };
    }).filter((rect) => rect.y > 26 && rect.y < 100);
    expect(projected).toHaveLength(studs.length);
    for (const [index, rect] of projected.entries()) {
      const stud = studs[index];
      if (!stud) throw new Error('Missing stud');
      // Elevation projects the same member faces as the 3D model, at 408 px / wall length.
      expect(rect.width).toBeCloseTo(stud.width * 408 / length);
      expect(rect.x).toBeCloseTo(40 + (stud.x - stud.width / 2 + length / 2) * 408 / length);
    }
    // The next layout stud is 9 inches clear of the 5 1/2-inch backing stud.
    expect(markup).toContain('9&quot;');
    // No phantom clear dimension between the two touching corner studs.
    expect(markup).not.toContain('0&quot;');
  });
});
