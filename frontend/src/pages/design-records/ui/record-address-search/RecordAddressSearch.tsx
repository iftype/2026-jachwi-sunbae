import { css } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';

import type { MapAddress } from '@/features/map/model/Map';
import AddressSearchResults from '@/features/map/ui/address-search-results/AddressSearchResults';
import useAddressSearch from '@/features/property/hooks/useAddressSearch';
import SearchField from '@/shared/ui/search-field/SearchField';

type Props = {
  /** 고른 주소로 지도를 옮긴다. */
  onSelect: (address: MapAddress) => void;
  autoFocus?: boolean;
  /** 넘기면 검색창 왼쪽에 뒤로가기를 두고 누르면 부른다. 휴대폰에서 검색을 접을 때 쓴다. */
  onBack?: () => void;
  /** 검색창 이름과 안내 문구. 기본은 지도를 옮기는 주소 검색이다. */
  label?: string;
  placeholder?: string;
  className?: string;
};

/** 입력을 멈추고 이만큼 지나면 검색한다. */
const SEARCH_DEBOUNCE_MS = 300;

const formatAddress = (address: MapAddress) => address.roadAddress ?? address.jibunAddress ?? address.address ?? '';

/** 본 방 기록 지도에서 주소를 찾아 그 자리로 지도를 옮기는 검색창. 결과는 검색창 바로 아래에 띄운다. */
const RecordAddressSearch = ({
  onSelect,
  autoFocus = false,
  onBack,
  label = '주소 검색',
  placeholder = '주소로 지도 이동',
  className,
}: Props) => {
  const search = useAddressSearch();
  // 검색창에서 손을 떼(포커스가 밖으로 나가) 결과 목록을 닫는다. 다시 눌러 입력하면 다시 열린다.
  const [isOpen, setIsOpen] = useState(true);
  const { query } = search;
  // 결과를 고르면 검색어가 그 주소로 바뀐다. 이때는 다시 검색하지 않는다.
  const pickedRef = useRef<string | null>(null);
  // submit은 렌더마다 새로 만들어진다. 검색어가 바뀔 때만 검색하도록 최신 것을 ref로 들고 있는다.
  const submitRef = useRef(search.submit);
  submitRef.current = search.submit;

  // 따로 제출하지 않고 입력할 때마다 검색한다. 입력이 멈춘 뒤에만 요청한다.
  useEffect(() => {
    if (query.trim() === '' || query === pickedRef.current) return;
    const timer = window.setTimeout(() => void submitRef.current(), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <div
      className={`${styles.root} ${className ?? ''}`.trim()}
      onFocus={() => setIsOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
      }}
    >
      <SearchField
        className={styles.field}
        shape="pill"
        label={label}
        placeholder={placeholder}
        value={search.query}
        showSubmitButton={false}
        autoFocus={autoFocus}
        onBack={onBack}
        onValueChange={search.changeQuery}
        onSubmit={() => void search.submit()}
        onClear={search.clear}
      />
      {isOpen && (
        // 결과를 누를 때 입력창의 포커스가 먼저 빠져 목록이 닫히지 않게 한다.
        <div onMouseDown={(event) => event.preventDefault()}>
          <AddressSearchResults
            results={search.results}
            dropdown
            status={search.status === 'idle' && search.results.length > 0 ? 'success' : search.status}
            onSelect={(result) => {
              pickedRef.current = formatAddress(result);
              search.pick(result);
              onSelect(result);
            }}
          />
        </div>
      )}
    </div>
  );
};

const styles = {
  root: css`
    label: RecordAddressSearch-root;
    position: relative;
    flex: 1;
    min-width: 0;
    /* 지도 위에 띄운 헤더는 빈 자리 클릭을 지도로 넘기므로, 검색창과 결과는 직접 받는다. */
    pointer-events: auto;
  `,

  field: css`
    label: RecordAddressSearch-field;
    min-width: 0;
    /* 입력칸 높이를 평소 헤더 버튼과 같은 2.5rem으로 고정한다. */
    height: 2.5rem;
    font-size: 0.9rem;
    box-sizing: border-box;
    background: white;
    box-shadow: none;

    & input {
      min-height: 0;
      height: 100%;
    }
  `,
};

export default RecordAddressSearch;
