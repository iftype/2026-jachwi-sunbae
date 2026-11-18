import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getAuthenticationSnapshot, setAuthentication } from '@/features/auth/model/authStore';
import { closeAuthenticationSyncForTests, startAuthenticationSync } from '@/features/auth/model/authSync';

const NativeBroadcastChannel = globalThis.BroadcastChannel;
const otherTab = () => new BroadcastChannel('jachwi-auth');

describe('탭 사이 회원 동기화', () => {
  let stop: () => void = () => undefined;
  const channels: BroadcastChannel[] = [];

  beforeEach(() => {
    closeAuthenticationSyncForTests();
    // 실제 BroadcastChannel은 jsdom과 워커 사이에도 전달되므로 다른 파일의 로그인 알림과 분리한다.
    const scope = crypto.randomUUID();
    vi.stubGlobal(
      'BroadcastChannel',
      class extends NativeBroadcastChannel {
        constructor(name: string) {
          super(`${name}:${scope}`);
        }
      },
    );
  });

  afterEach(() => {
    stop();
    channels.forEach((channel) => channel.close());
    channels.length = 0;
    closeAuthenticationSyncForTests();
    vi.unstubAllGlobals();
  });

  const announceFromOtherTab = (memberId: number) => {
    const channel = otherTab();
    channels.push(channel);
    channel.postMessage({ type: 'member-changed', memberId });
  };

  it('다른 탭이 다른 회원으로 바뀌면 이전 회원의 인증을 버리고 화면을 새로 연다', async () => {
    setAuthentication({ accessToken: 'old-member', tokenType: 'Bearer', expiresIn: 900, memberId: 20 });
    const reload = vi.fn();
    stop = startAuthenticationSync({ reload });

    announceFromOtherTab(10);

    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(getAuthenticationSnapshot()).toEqual({ session: null, terminationReason: null });
  });

  it('같은 회원이면 아무것도 하지 않는다', async () => {
    setAuthentication({ accessToken: 'same-member', tokenType: 'Bearer', expiresIn: 900, memberId: 10 });
    const reload = vi.fn();
    stop = startAuthenticationSync({ reload });

    announceFromOtherTab(10);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(reload).not.toHaveBeenCalled();
    expect(getAuthenticationSnapshot().session?.memberId).toBe(10);
  });
});
