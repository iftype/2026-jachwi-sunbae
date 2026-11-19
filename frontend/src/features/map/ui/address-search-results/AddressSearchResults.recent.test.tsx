import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { addRecentAddress, readRecentAddresses } from '../../lib/recentAddressStore';
import type { MapAddress } from '../../model/Map';
import AddressSearchResults from './AddressSearchResults';

const gangnam: MapAddress = {
  address: '서울 강남구 역삼동 1',
  roadAddress: '서울 강남구 테헤란로 1',
  jibunAddress: '서울 강남구 역삼동 1',
  latitude: 37.5,
  longitude: 127.03,
};
const mapo: MapAddress = {
  address: '서울 마포구 합정동 2',
  roadAddress: '서울 마포구 양화로 2',
  jibunAddress: null,
  latitude: 37.55,
  longitude: 126.91,
};

const renderRecent = (onSelect = vi.fn()) =>
  render(<AddressSearchResults dropdown recent status="idle" results={[]} onSelect={onSelect} />);

describe('검색창 최근 검색', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => window.localStorage.clear());

  it('기록이 없으면 영역을 그리지 않는다', () => {
    const { container } = renderRecent();
    expect(container).toBeEmptyDOMElement();
  });

  it('검색어가 비어 있지 않으면(recent가 꺼져 있으면) 최근 검색을 보이지 않는다', () => {
    addRecentAddress(gangnam);
    const { container } = render(
      <AddressSearchResults dropdown status="idle" results={[]} onSelect={() => undefined} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('최근 검색을 주소와 부제로 보인다', () => {
    addRecentAddress(mapo);
    addRecentAddress(gangnam);
    renderRecent();
    expect(screen.getByRole('heading', { name: '최근 검색' })).toBeInTheDocument();
    expect(screen.getByText('서울 강남구 테헤란로 1')).toBeInTheDocument();
    expect(screen.getByText('서울 강남구 역삼동 1')).toBeInTheDocument();
    expect(screen.getByText('서울 마포구 양화로 2')).toBeInTheDocument();
  });

  it('항목을 누르면 그 주소를 고른 것으로 처리한다', () => {
    addRecentAddress(gangnam);
    const onSelect = vi.fn();
    renderRecent(onSelect);
    fireEvent.click(screen.getByText('서울 강남구 테헤란로 1'));
    expect(onSelect).toHaveBeenCalledWith(gangnam);
  });

  it('x로 한 항목만 지우면 저장소와 화면이 바로 갱신된다', () => {
    addRecentAddress(mapo);
    addRecentAddress(gangnam);
    renderRecent();
    fireEvent.click(screen.getByRole('button', { name: '서울 강남구 테헤란로 1 기록 지우기' }));
    expect(screen.queryByText('서울 강남구 테헤란로 1')).not.toBeInTheDocument();
    expect(readRecentAddresses()).toEqual([mapo]);
  });

  it('전체 지우기를 누르면 영역이 사라지고 저장소 키도 지워진다', () => {
    addRecentAddress(mapo);
    addRecentAddress(gangnam);
    const { container } = renderRecent();
    fireEvent.click(screen.getByRole('button', { name: '전체 지우기' }));
    expect(container).toBeEmptyDOMElement();
    expect(window.localStorage.getItem('jachwi-sunbae:recent-addresses')).toBeNull();
  });

  it('검색 결과에서 주소를 고르면 최근 검색으로 저장한다', () => {
    const onSelect = vi.fn();
    render(<AddressSearchResults dropdown status="success" results={[gangnam]} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('서울 강남구 테헤란로 1'));
    expect(onSelect).toHaveBeenCalledWith(gangnam);
    expect(readRecentAddresses()).toEqual([gangnam]);
  });
});
