import { describe, it, expect } from 'vitest';
import { getPortKey, DEFAULT_PORTS, ETC_PORT_KEY } from '../index';
import type { PortInfo } from '../../types';

describe('getPortKey', () => {
  it('port型ならport番号を返す', () => {
    const portInfo: PortInfo = { type: 'port', port: 80, label: 'HTTP' };
    expect(getPortKey(portInfo)).toBe(80);
  });

  it('etc型ならETC_PORT_KEYを返す', () => {
    const portInfo: PortInfo = { type: 'etc', label: 'Other' };
    expect(getPortKey(portInfo)).toBe(ETC_PORT_KEY);
  });

  it('ETC_PORT_KEYは-1', () => {
    expect(ETC_PORT_KEY).toBe(-1);
  });
});

describe('DEFAULT_PORTS', () => {
  it('配列が空でない', () => {
    expect(DEFAULT_PORTS.length).toBeGreaterThan(0);
  });

  it('末尾がetc型', () => {
    const last = DEFAULT_PORTS[DEFAULT_PORTS.length - 1];
    expect(last.type).toBe('etc');
  });

  it('最初のエントリがport型', () => {
    expect(DEFAULT_PORTS[0].type).toBe('port');
  });
});
