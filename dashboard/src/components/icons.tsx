import type { ComponentChildren } from 'preact';

export interface IconProps {
  size?: number;
  class?: string;
}

function Svg({
  size = 20,
  class: className,
  children,
}: IconProps & { children: ComponentChildren }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={className ? `icon ${className}` : 'icon'}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Device category icon: mouse, headset, keyboard, gamepad, or generic peripheral fallback. */
export function DeviceKindIcon({ kind, size = 22, class: className }: IconProps & { kind: string }) {
  switch (kind) {
    case 'mouse':
      return (
        <Svg size={size} {...(className ? { class: className } : {})}>
          <rect x="6.5" y="2.5" width="11" height="19" rx="5.5" />
          <path d="M12 6.5v3.5" />
          <path d="M6.75 10.5h10.5" opacity="0.45" />
        </Svg>
      );
    case 'headset':
      return (
        <Svg size={size} {...(className ? { class: className } : {})}>
          <path d="M4 13.5V12a8 8 0 0 1 16 0v1.5" />
          <rect x="3" y="12.5" width="3.5" height="6.5" rx="1.75" />
          <rect x="17.5" y="12.5" width="3.5" height="6.5" rx="1.75" />
          <path d="M6.5 18.5c0 1.6 1.6 2.5 4 2.5h1.5" />
        </Svg>
      );
    case 'keyboard':
      return (
        <Svg size={size} {...(className ? { class: className } : {})}>
          <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
          <path d="M6 10h1.5M10 10h1.5M14 10h1.5M17.5 10h.5" />
          <path d="M6 14h12" />
        </Svg>
      );
    case 'gamepad':
      return (
        <Svg size={size} {...(className ? { class: className } : {})}>
          <path d="M6.5 8h11a3.5 3.5 0 0 1 3.4 4.3l-.9 4A2.5 2.5 0 0 1 17.5 18a2.5 2.5 0 0 1-2-.9l-1.3-1.6h-4.4l-1.3 1.6a2.5 2.5 0 0 1-2 .9A2.5 2.5 0 0 1 4 16.3l-.9-4A3.5 3.5 0 0 1 6.5 8Z" />
          <path d="M8 10.75v2.5M6.75 12h2.5" />
          <circle cx="15.5" cy="11.2" r="0.6" fill="currentColor" stroke="none" />
          <circle cx="17.3" cy="12.8" r="0.6" fill="currentColor" stroke="none" />
        </Svg>
      );
    default:
      return (
        <Svg size={size} {...(className ? { class: className } : {})}>
          <rect x="5" y="6" width="14" height="12" rx="2" />
          <path d="M9 3v3M15 3v3M9 18v3M15 18v3" />
          <circle cx="12" cy="12" r="2" />
        </Svg>
      );
  }
}

/** Battery icon reflecting level (0-100), charging state, or unknown/unavailable. */
export function BatteryIcon({
  level,
  charging = false,
  unavailable = false,
  size = 18,
  class: className,
}: IconProps & { level?: number | undefined; charging?: boolean; unavailable?: boolean }) {
  const pct = typeof level === 'number' ? Math.max(0, Math.min(100, level)) : null;
  const fillWidth = pct === null ? 0 : Math.max(pct > 0 ? 1.5 : 0, (pct / 100) * 12.5);
  return (
    <Svg size={size} {...(className ? { class: className } : {})}>
      <rect x="2.5" y="6.5" width="16.5" height="11" rx="2" />
      <path d="M21 10v4" />
      {pct !== null && !charging && (
        <rect x="4.5" y="8.5" width={fillWidth} height="7" rx="0.8" fill="currentColor" stroke="none" />
      )}
      {charging && <path d="M11.5 9 9.2 12.2h3.1L10 15" stroke-width="1.6" />}
      {unavailable && pct === null && <path d="M9 10.5c0-1 .8-1.6 1.7-1.6.9 0 1.6.6 1.6 1.4 0 .7-.5 1.1-1.2 1.4-.4.2-.6.5-.6 1M10.5 14.8v.1" />}
    </Svg>
  );
}

/** Microphone state icon: open, muted with slash, or unavailable. */
export function MicIcon({
  state,
  size = 20,
  class: className,
}: IconProps & { state: 'on' | 'muted' | 'unavailable' }) {
  if (state === 'muted') {
    return (
      <Svg size={size} {...(className ? { class: className } : {})}>
        <path d="M9 5a3 3 0 0 1 6 0v5a3 3 0 0 1-.4 1.5" />
        <path d="M18.5 10.5a6.5 6.5 0 0 1-.8 3.1" />
        <path d="M5.5 10.5a6.5 6.5 0 0 0 9.6 5.7" />
        <path d="M12 17v4M8.5 21h7" />
        <path d="m3 3 18 18" />
      </Svg>
    );
  }
  if (state === 'unavailable') {
    return (
      <Svg size={size} {...(className ? { class: className } : {})}>
        <rect x="9" y="3" width="6" height="10" rx="3" opacity="0.5" />
        <path d="M5.5 10.5a6.5 6.5 0 0 0 13 0" opacity="0.5" />
        <path d="M12 17v4M8.5 21h7" opacity="0.5" />
      </Svg>
    );
  }
  return (
    <Svg size={size} {...(className ? { class: className } : {})}>
      <rect x="9" y="3" width="6" height="10" rx="3" />
      <path d="M5.5 10.5a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17v4M8.5 21h7" />
    </Svg>
  );
}

/** Connection transport icon: wired USB, 2.4G wireless receiver, or Bluetooth. */
export function TransportIcon({ transport, size = 15, class: className }: IconProps & { transport: string }) {
  switch (transport) {
    case 'wired':
      return (
        <Svg size={size} {...(className ? { class: className } : {})}>
          <path d="M12 3v14" />
          <path d="m9 6 3-3 3 3" />
          <path d="M12 13l-4-3V7.5" />
          <path d="M12 11l4-2.5V6.5" />
          <circle cx="8" cy="7" r="1" fill="currentColor" stroke="none" />
          <rect x="15" y="5" width="2" height="2" fill="currentColor" stroke="none" />
          <circle cx="12" cy="19" r="2" />
        </Svg>
      );
    case 'bluetooth':
      return (
        <Svg size={size} {...(className ? { class: className } : {})}>
          <path d="m6.5 7 11 10-5.5 4V3l5.5 4-11 10" />
        </Svg>
      );
    case 'receiver':
    default:
      return (
        <Svg size={size} {...(className ? { class: className } : {})}>
          <rect x="9" y="13" width="6" height="7" rx="1.2" />
          <path d="M10.5 20v1.5M13.5 20v1.5" />
          <path d="M7.5 10.5a6.5 6.5 0 0 1 9 0" />
          <path d="M5 7.5a10 10 0 0 1 14 0" />
          <circle cx="12" cy="16.5" r="0.7" fill="currentColor" stroke="none" />
        </Svg>
      );
  }
}

export function RefreshIcon({ size = 16, class: className }: IconProps) {
  return (
    <Svg size={size} {...(className ? { class: className } : {})}>
      <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4" />
      <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4" />
    </Svg>
  );
}

export function SettingsGearIcon({ size = 16, class: className }: IconProps) {
  return (
    <Svg size={size} {...(className ? { class: className } : {})}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </Svg>
  );
}

export function ChevronRightIcon({ size = 16, class: className }: IconProps) {
  return (
    <Svg size={size} {...(className ? { class: className } : {})}>
      <path d="m9 6 6 6-6 6" />
    </Svg>
  );
}

export function ChevronLeftIcon({ size = 16, class: className }: IconProps) {
  return (
    <Svg size={size} {...(className ? { class: className } : {})}>
      <path d="m15 6-6 6 6 6" />
    </Svg>
  );
}

export function ExternalLinkIcon({ size = 15, class: className }: IconProps) {
  return (
    <Svg size={size} {...(className ? { class: className } : {})}>
      <path d="M15 4h5v5" />
      <path d="M10 14 20 4" />
      <path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
    </Svg>
  );
}

export function CheckIcon({ size = 15, class: className }: IconProps) {
  return (
    <Svg size={size} {...(className ? { class: className } : {})}>
      <path d="M5 12.5 9.5 17 19 7" />
    </Svg>
  );
}

export function AlertIcon({ size = 15, class: className }: IconProps) {
  return (
    <Svg size={size} {...(className ? { class: className } : {})}>
      <path d="M10.3 3.9 2.4 17.5A1.7 1.7 0 0 0 3.9 20h16.2a1.7 1.7 0 0 0 1.5-2.5L13.7 3.9a1.7 1.7 0 0 0-3.4 0Z" />
      <path d="M12 9.5v4M12 16.8v.1" />
    </Svg>
  );
}

export function InfoIcon({ size = 15, class: className }: IconProps) {
  return (
    <Svg size={size} {...(className ? { class: className } : {})}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11.5v4.5M12 8.2v.1" />
    </Svg>
  );
}

export function CpuIcon({ size = 16, class: className }: IconProps) {
  return (
    <Svg size={size} {...(className ? { class: className } : {})}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="0.5" />
      <path d="M9 2.5v3.5M15 2.5v3.5M9 18v3.5M15 18v3.5M2.5 9H6M2.5 15H6M18 9h3.5M18 15h3.5" />
    </Svg>
  );
}

export function PlusIcon({ size = 16, class: className }: IconProps) {
  return (
    <Svg size={size} {...(className ? { class: className } : {})}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function TrashIcon({ size = 15, class: className }: IconProps) {
  return (
    <Svg size={size} {...(className ? { class: className } : {})}>
      <path d="M4 7h16M9.5 4h5M9.5 11v5M14.5 11v5" />
      <path d="M6.5 7l.8 11.5A2 2 0 0 0 9.3 20.5h5.4a2 2 0 0 0 2-2L17.5 7" />
    </Svg>
  );
}
