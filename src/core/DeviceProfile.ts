export interface DeviceConfig {
  isMobile: boolean;
  aimSensitivity: number;
  scrollSensitivity: number;
}

export function getDeviceProfile(): DeviceConfig {
  const isMobile =
    typeof window !== 'undefined' &&
    window.matchMedia('(pointer: coarse)').matches;

  return {
    isMobile,
    aimSensitivity: isMobile ? 0.005 : 0.005,
    scrollSensitivity: isMobile ? 0.05 : 0.05,
  };
}
