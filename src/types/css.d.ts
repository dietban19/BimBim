import 'react';

declare module 'react' {
  interface CSSProperties {
    /** Allows typed CSS custom properties in inline styles. */
    [customProperty: `--${string}`]: string | number | undefined;
  }
}
