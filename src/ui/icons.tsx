import type { ReactElement, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps): ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function SelectIcon(): ReactElement {
  return (
    <Icon>
      <path d="M3.5 2.5l8.5 5-3.8.9-1.9 3.6z" />
    </Icon>
  );
}

export function WallIcon(): ReactElement {
  return (
    <Icon>
      <path d="M2 13.5h12" />
      <rect x="3.5" y="5" width="9" height="8.5" />
      <path d="M3.5 9.25h9M8 5v4.25M5.75 9.25v4.25M10.25 9.25v4.25" />
    </Icon>
  );
}

export function ResizeIcon(): ReactElement {
  return (
    <Icon>
      <path d="M4.5 8h7" />
      <circle cx="2.75" cy="8" r="1.5" />
      <circle cx="13.25" cy="8" r="1.5" />
      <path d="M6 6.25L4.5 8 6 9.75M10 6.25L11.5 8 10 9.75" />
    </Icon>
  );
}

export function DeleteIcon(): ReactElement {
  return (
    <Icon>
      <path d="M2.75 4.25h10.5M6.25 4.25V2.75h3.5v1.5M4 4.25l.6 9h6.8l.6-9M6.75 6.75v4M9.25 6.75v4" />
    </Icon>
  );
}

export function ResetViewIcon(): ReactElement {
  return (
    <Icon>
      <path d="M2.75 8a5.25 5.25 0 1 0 1.6-3.8" />
      <path d="M2.5 2.5v2.5H5" />
      <circle cx="8" cy="8" r="1.2" />
    </Icon>
  );
}

export function WallListIcon(): ReactElement {
  return (
    <Icon width="14" height="14">
      <rect x="2.5" y="5.5" width="11" height="5" />
    </Icon>
  );
}
