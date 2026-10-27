import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import AppRoutes from '@/app/router/AppRoutes';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';

const HistoryControls = () => {
  const navigate = useNavigate();
  return (
    <>
      <button onClick={() => navigate(-1)}>테스트 이전 화면</button>
      <button onClick={() => navigate(1)}>테스트 다음 화면</button>
    </>
  );
};

const renderFlow = (path = '/me') =>
  render(
    <StrictMode>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
        <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost:8080', mapProviderMode: 'demo' }}>
          <MemoryRouter initialEntries={[path]}>
            <HistoryControls />
            <AppRoutes />
          </MemoryRouter>
        </PublicConfigProvider>
      </QueryClientProvider>
    </StrictMode>,
  );

describe('생활 날씨 프로토타입 사용자 흐름', () => {
  it('알림이 꺼져 있으면 알림 꺼짐 안내를 보이고, 켜면 OS 권한 결과에 따라 날씨와 확인 알림을 보인다', async () => {
    const user = userEvent.setup();
    renderFlow();
    expect(await screen.findByText('생활 날씨 알림이 꺼져 있어요')).toBeInTheDocument();
    // 홈의 빠른 메뉴와 겹치는 기록 메뉴는 두지 않는다.
    expect(screen.queryByRole('navigation', { name: '내 기록' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /개인정보 처리방침/ })).toHaveAttribute('href', '/privacy');
    // 계정 삭제는 카드 → 확인 한 번으로 회원 번호가 채워진 메일을 연다.
    await user.click(screen.getByRole('button', { name: /계정 및 데이터 삭제 요청/ }));
    expect(screen.getByRole('dialog', { name: '계정 삭제를 요청할까요?' })).toHaveTextContent(/회원 번호 \d+/);
    await user.keyboard('{Escape}');
    expect(screen.queryByText(/프로토타입|샘플|시연/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '생활 날씨 알림 설정' })).not.toBeInTheDocument();
    const toggle = screen.getByRole('switch', { name: '알림 받기' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    await user.click(toggle);
    // 권한은 OS가 직접 묻으므로 웹은 별도 안내 창을 띄우지 않는다.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('서울 시청')).toBeInTheDocument();
    expect(screen.getByText(/^\d{2}시 예보$/)).toBeInTheDocument();
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('생활 날씨 알림이 꺼져 있어요')).toBeInTheDocument();
    // 켜고 끌 때 웹 화면에는 별도 알림(토스트)을 띄우지 않는다.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('기기 알림 권한이 거부되면 켜지지 않고 설정 열기를 안내하며, 웹에서는 토글을 막는다', async () => {
    const user = userEvent.setup();
    renderFlow('/weather/settings');
    await user.click(await screen.findByText('상황 바꿔 보기'));
    await user.selectOptions(screen.getByLabelText('기기 알림 권한'), 'denied');
    const toggle = screen.getByRole('switch', { name: '알림 받기' });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('기기 알림이 꺼져 있어요.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '설정 열기' }));
    expect(screen.queryByText('기기 알림이 꺼져 있어요.')).not.toBeInTheDocument();
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    await user.selectOptions(screen.getByLabelText('접속 환경'), 'web');
    expect(toggle).toBeDisabled();
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('앱에서 알림을 받을 수 있어요.')).toBeInTheDocument();
  });

  it('현재 위치를 찾지 못하면 마지막 위치 기준임을 표시한다', async () => {
    const user = userEvent.setup();
    renderFlow('/weather/settings');
    await user.click(await screen.findByText('상황 바꿔 보기'));
    await user.selectOptions(screen.getByLabelText('날씨 상황 선택'), 'rain');
    await user.click(screen.getByLabelText('현재 위치를 찾지 못함 (마지막 위치 사용)'));
    expect(screen.getByText(/현재 위치를 찾지 못해 마지막 위치를 사용해요/)).toBeInTheDocument();
  });

  it('날씨 상세는 오늘·내일 24시간 예보가 바뀌고 설정에서 진입했던 상세로 돌아온다', async () => {
    const user = userEvent.setup();
    renderFlow('/weather');
    await user.click(await screen.findByText('상황 바꿔 보기'));
    await user.selectOptions(screen.getByLabelText('날씨 상황 선택'), 'rain');
    const list = await screen.findByRole('list', { name: '시간별 예보' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(24);
    const today = within(list).getByRole('listitem', { name: '15시 예보' }).textContent;
    expect(screen.getByRole('button', { name: '오늘' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: '내일' }));
    expect(within(list).getByRole('listitem', { name: '15시 예보' }).textContent).not.toBe(today);
    expect(within(list).getByRole('listitem', { name: '03시 예보' })).toHaveTextContent('정보 없음');
    expect(within(list).getByRole('listitem', { name: '00시 예보' })).toHaveTextContent('0 mm');
    expect(document.querySelectorAll('header')).toHaveLength(1);
    const scrollContainer = screen.getByRole('main').parentElement;
    if (scrollContainer === null) throw new Error('앱 스크롤 영역이 없습니다.');
    scrollContainer.scrollTop = 400;
    await user.click(screen.getByRole('link', { name: '생활 날씨 알림 설정' }));
    expect(await screen.findByRole('switch', { name: '알림 받기' })).toHaveAttribute('aria-checked', 'false');
    expect(scrollContainer.scrollTop).toBe(0);
    expect(document.querySelectorAll('header')).toHaveLength(1);
    expect(screen.getByRole('link', { name: '뒤로 가기' })).toHaveAttribute('href', '/weather');
    await user.click(screen.getByRole('switch', { name: '알림 받기' }));
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('switch'));
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByLabelText('발송 시간')).toHaveValue('MORNING');
    await user.click(screen.getByRole('button', { name: '알림 미리보기' }));
    expect(screen.getByRole('link', { name: /눌러서 알림 당시 내용 보기/ })).toHaveTextContent(
      '오늘 비 예보가 있어요. 우산을 준비하세요',
    );
  });

  it('저녁 알림은 내일의 눈·추위를 담고 시나리오 변경 후에도 당시 상세가 유지된다', async () => {
    const user = userEvent.setup();
    renderFlow('/weather/settings');
    await screen.findByRole('switch');
    expect(screen.getByRole('button', { name: '알림 미리보기' })).toBeDisabled();
    await user.click(screen.getByText('상황 바꿔 보기'));
    await user.selectOptions(screen.getByLabelText('날씨 상황 선택'), 'snow');
    await user.selectOptions(screen.getByLabelText('발송 시간'), 'EVENING');
    await user.click(screen.getByRole('button', { name: '알림 미리보기' }));
    await user.click(screen.getByRole('link', { name: /눌러서 알림 당시 내용 보기/ }));
    expect(
      await screen.findByRole('heading', { name: '내일 눈 예보가 있어요. 이동에 주의하세요' }),
    ).toBeInTheDocument();
    expect(screen.getByText('오후 10시 · 저녁')).toBeInTheDocument();
    expect(screen.getByText('추위 예보가 있어요. 노출된 수도관 보온을 점검하세요')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '테스트 이전 화면' }));
    await screen.findByRole('switch');
    await user.click(screen.getByText('상황 바꿔 보기'));
    await user.selectOptions(screen.getByLabelText('날씨 상황 선택'), 'laundry');
    expect(screen.queryByRole('link', { name: /눌러서 알림 당시 내용 보기/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '테스트 다음 화면' }));
    expect(
      await screen.findByRole('heading', { name: '내일 눈 예보가 있어요. 이동에 주의하세요' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('09~18시 예보상 바깥 건조를 고려할 수 있어요')).not.toBeInTheDocument();
  });

  it('직접 진입·예보 없음·위치 거부·초기화를 안전하게 처리한다', async () => {
    const user = userEvent.setup();
    renderFlow('/weather');
    await screen.findByText('우리 동네 날씨를 확인해 보세요');
    await user.click(screen.getByText('상황 바꿔 보기'));
    await user.selectOptions(screen.getByLabelText('날씨 상황 선택'), 'empty');
    expect(screen.getByText('아직 예보 정보가 없어요')).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: '시간별 예보' })).getAllByRole('listitem')).toHaveLength(24);
    await user.click(screen.getByRole('link', { name: '생활 날씨 알림 설정' }));
    expect(await screen.findByRole('button', { name: '알림 미리보기' })).toBeDisabled();
    await user.click(screen.getByText('상황 바꿔 보기'));
    await user.selectOptions(screen.getByLabelText('날씨 상황 선택'), 'denied');
    expect(screen.getByText('저장된 위치 없음')).toBeInTheDocument();
    await user.click(screen.getByRole('switch'));
    await user.click(screen.getByRole('button', { name: '처음 상태로 되돌리기' }));
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    await user.click(screen.getByRole('link', { name: '위치 선택하기' }));
    expect(await screen.findByText('우리 동네 날씨를 확인해 보세요')).toBeInTheDocument();
  });

  it.each(['missing', 'toString'])('없는 알림 주소 %s는 복구 안내를 제공한다', async (id) => {
    renderFlow(`/weather/notifications/${id}`);
    expect(await screen.findByText('이 알림을 찾을 수 없어요')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '알림 설정으로 가기' })).toHaveAttribute('href', '/weather/settings');
  });
});
