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
  it('첫 위치는 미확인이고 기존 메뉴 순서를 유지하며 거부 후 허용할 수 있다', async () => {
    const user = userEvent.setup();
    renderFlow();
    expect(await screen.findByText('우리 동네 날씨를 확인해 보세요')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '서울 시청 날씨 상세 보기' })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('navigation', { name: '내 기록' }))
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['내 매물 관리', '내 체크리스트 관리', '지도와 주변 시설', '매물 비교 PDF', '사용 방법']);
    await user.click(screen.getByRole('button', { name: '내 위치 날씨 확인하기' }));
    expect(screen.getByRole('dialog', { name: '위치 사용 안내' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '위치 사용 거부' }));
    expect(screen.getByText('위치가 없어 날씨를 볼 수 없어요')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '위치 사용 다시 선택하기' }));
    await user.click(screen.getByRole('button', { name: '위치 사용 허용' }));
    expect(screen.getByText('샘플 위치')).toBeInTheDocument();
    expect(screen.getByText(/시 예보 · 실시간 관측 아님/)).toBeInTheDocument();
  });

  it('위치 안내를 Escape로 닫으면 최초 상태와 키보드 포커스를 복원한다', async () => {
    const user = userEvent.setup();
    renderFlow();
    const trigger = await screen.findByRole('button', { name: '내 위치 날씨 확인하기' });
    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('날씨 상세는 오늘·내일 24시간 예보가 바뀌고 설정에서 진입했던 상세로 돌아온다', async () => {
    const user = userEvent.setup();
    renderFlow();
    await user.click(await screen.findByText(/프로토타입 시나리오/));
    await user.selectOptions(screen.getByLabelText('날씨 상황 선택'), 'rain');
    await user.click(screen.getByRole('button', { name: '오후 10시 · 내일 날씨' }));
    expect(screen.getByText('내일 비 예보가 있어요. 우산을 챙기세요!')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: '서울 시청 날씨 상세 보기' }));
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
    expect(await screen.findByRole('switch', { name: '알림 수신' })).toHaveAttribute('aria-checked', 'false');
    expect(scrollContainer.scrollTop).toBe(0);
    expect(document.querySelectorAll('header')).toHaveLength(1);
    expect(screen.getByRole('link', { name: '뒤로 가기' })).toHaveAttribute('href', '/weather');
    await user.click(screen.getByRole('switch', { name: '알림 수신' }));
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('switch'));
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByLabelText('시연할 발송 시간')).toHaveValue('MORNING');
    await user.click(screen.getByRole('button', { name: '가상 알림 확인하기' }));
    expect(screen.getByRole('link', { name: /눌러서 알림 당시 내용 보기/ })).toHaveTextContent(
      '오늘 비 예보가 있어요. 우산을 준비하세요',
    );
  });

  it('저녁 가상 푸시는 내일의 눈·추위를 담고 시나리오 변경 후에도 당시 상세가 유지된다', async () => {
    const user = userEvent.setup();
    renderFlow('/weather/settings');
    await screen.findByRole('switch');
    expect(screen.getByRole('button', { name: '가상 알림 확인하기' })).toBeDisabled();
    await user.click(screen.getByText(/프로토타입 시나리오/));
    await user.selectOptions(screen.getByLabelText('날씨 상황 선택'), 'snow');
    await user.selectOptions(screen.getByLabelText('시연할 발송 시간'), 'EVENING');
    await user.click(screen.getByRole('button', { name: '가상 알림 확인하기' }));
    await user.click(screen.getByRole('link', { name: /눌러서 알림 당시 내용 보기/ }));
    expect(
      await screen.findByRole('heading', { name: '내일 눈 예보가 있어요. 이동에 주의하세요' }),
    ).toBeInTheDocument();
    expect(screen.getByText('오후 10시 · 저녁')).toBeInTheDocument();
    expect(screen.getByText('추위 예보가 있어요. 노출된 수도관 보온을 점검하세요')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '테스트 이전 화면' }));
    await screen.findByRole('switch');
    await user.click(screen.getByText(/프로토타입 시나리오/));
    await user.selectOptions(screen.getByLabelText('날씨 상황 선택'), 'laundry');
    expect(screen.queryByRole('link', { name: /눌러서 알림 당시 내용 보기/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '테스트 다음 화면' }));
    expect(
      await screen.findByRole('heading', { name: '내일 눈 예보가 있어요. 이동에 주의하세요' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('09~18시 예보상 바깥 건조를 고려할 수 있어요')).not.toBeInTheDocument();
  });

  it('직접 진입·예보 없음·위치 거부·시연 초기화를 안전하게 처리한다', async () => {
    const user = userEvent.setup();
    renderFlow('/weather');
    await screen.findByText('우리 동네 날씨를 확인해 보세요');
    await user.click(screen.getByText(/프로토타입 시나리오/));
    await user.selectOptions(screen.getByLabelText('날씨 상황 선택'), 'empty');
    expect(screen.getByText('아직 예보 정보가 없어요')).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: '시간별 예보' })).getAllByRole('listitem')).toHaveLength(24);
    await user.click(screen.getByRole('link', { name: '생활 날씨 알림 설정' }));
    expect(await screen.findByRole('button', { name: '가상 알림 확인하기' })).toBeDisabled();
    await user.click(screen.getByText(/프로토타입 시나리오/));
    await user.selectOptions(screen.getByLabelText('날씨 상황 선택'), 'denied');
    expect(screen.getByText('선택한 샘플 위치 없음')).toBeInTheDocument();
    await user.click(screen.getByRole('switch'));
    await user.click(screen.getByRole('button', { name: '처음부터 시연하기' }));
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    await user.click(screen.getByRole('link', { name: '샘플 위치 선택하기' }));
    expect(await screen.findByText('우리 동네 날씨를 확인해 보세요')).toBeInTheDocument();
  });

  it.each(['missing', 'toString'])('없는 알림 주소 %s는 복구 안내를 제공한다', async (id) => {
    renderFlow(`/weather/notifications/${id}`);
    expect(await screen.findByText('이 가상 알림을 찾을 수 없어요')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '가상 알림 만들러 가기' })).toHaveAttribute('href', '/weather/settings');
  });
});
