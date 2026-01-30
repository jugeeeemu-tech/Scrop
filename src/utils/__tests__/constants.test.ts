import { describe, it, expect } from 'vitest';
import { getServiceName, getServiceColors, SERVICE_COLORS } from '../constants';

describe('getServiceName', () => {
  it('既知ポート番号のサービス名を返す', () => {
    expect(getServiceName(80)).toBe('HTTP');
    expect(getServiceName(443)).toBe('HTTPS');
    expect(getServiceName(22)).toBe('SSH');
    expect(getServiceName(8080)).toBe('Proxy');
  });

  it('未知ポート番号は"Other"を返す', () => {
    expect(getServiceName(12345)).toBe('Other');
    expect(getServiceName(0)).toBe('Other');
    expect(getServiceName(99999)).toBe('Other');
  });
});

describe('getServiceColors', () => {
  it('既知サービス名の色を返す', () => {
    const httpColors = getServiceColors('HTTP');
    expect(httpColors).toEqual(SERVICE_COLORS.HTTP);
    expect(httpColors.bg).toBeDefined();
    expect(httpColors.text).toBeDefined();
    expect(httpColors.light).toBeDefined();
  });

  it('未知サービス名はOtherの色を返す', () => {
    const colors = getServiceColors('UnknownService');
    expect(colors).toEqual(SERVICE_COLORS.Other);
  });

  it('各色オブジェクトはbg, text, lightを持つ', () => {
    for (const [, colors] of Object.entries(SERVICE_COLORS)) {
      expect(colors).toHaveProperty('bg');
      expect(colors).toHaveProperty('text');
      expect(colors).toHaveProperty('light');
    }
  });
});
