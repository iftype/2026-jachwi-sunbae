import { useRef, useState } from 'react';

import { Button } from '@/shared/ui/button/Button';
import ConfirmDialog from '@/shared/ui/confirm-dialog/ConfirmDialog';
import Icon from '@/shared/ui/icon/Icon';

import { useWeatherPrototype } from '../../model/WeatherPrototypeProvider';

import styles from './LocationPrompt.module.css';

const LocationPrompt = () => {
  const { locationChoice, chooseLocation } = useWeatherPrototype();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isDenied = locationChoice === 'denied';
  const choose = (choice: 'allowed' | 'denied') => {
    setIsOpen(false);
    chooseLocation(choice);
  };
  return (
    <div className={styles.prompt}>
      <span className={styles.symbol}>
        <Icon name="locate" size={24} />
      </span>
      <h3>{isDenied ? '위치가 없어 날씨를 볼 수 없어요' : '우리 동네 날씨를 확인해 보세요'}</h3>
      <p>
        {isDenied
          ? '위치 사용을 다시 선택하면 샘플 지역의 날씨를 볼 수 있어요.'
          : '현재 위치를 기반으로 오늘과 내일의 날씨를 알려드려요.'}
      </p>
      <Button ref={triggerRef} variant="soft" fullWidth onClick={() => setIsOpen(true)}>
        {isDenied ? '위치 사용 다시 선택하기' : '내 위치 날씨 확인하기'}
      </Button>
      <ConfirmDialog
        isOpen={isOpen}
        title="위치 사용 안내"
        confirmLabel="위치 사용 허용"
        isConfirming={false}
        tone="primary"
        returnFocusRef={triggerRef}
        onCancel={() => setIsOpen(false)}
        onConfirm={() => choose('allowed')}
        description={
          <p>
            이 화면은 프로토타입이에요. 허용하면 서울 시청을 샘플 위치로 선택해요. 실제 GPS를 수집하거나 기기의 위치
            권한을 요청하지 않아요.
          </p>
        }
      >
        <Button variant="secondary" fullWidth onClick={() => choose('denied')}>
          위치 사용 거부
        </Button>
      </ConfirmDialog>
    </div>
  );
};

export default LocationPrompt;
