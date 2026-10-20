import { type CSSProperties, type KeyboardEvent, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { trackExplorationRecordView } from '@/features/onboarding/lib/explorationJourney';
import MoneyField from '@/features/property/ui/money-field/MoneyField';
import { useKeyboardInset } from '@/shared/lib/hooks/useKeyboardInset';
import BottomActionArea from '@/shared/ui/bottom-action-area/BottomActionArea';
import { Button } from '@/shared/ui/button/Button';
import TextField from '@/shared/ui/text-field/TextField';
import TopNavigation from '@/shared/ui/top-navigation/TopNavigation';

import { type PropertyCreationRouteState, usePropertyCreationForm } from './hooks/usePropertyCreationForm';
import PropertyLocationPicker from './ui/property-location-picker/PropertyLocationPicker';

import styles from './CreatePropertyPage.module.css';

const stepNotice = (revealedStep: number, isReadyToSubmit: boolean) => {
  if (isReadyToSubmit) return '필수 정보를 모두 입력했다면 매물을 등록해 주세요.';
  if (revealedStep === 0) return '보증금을 입력한 뒤 다음을 눌러 주세요.';
  if (revealedStep === 1) return '월세를 입력한 뒤 다음을 눌러 주세요.';
  return '위치를 선택한 뒤 다음을 눌러 주세요.';
};

/** 다른 화면 옆 패널로 열 때 쓴다. 닫기와 등록 뒤 이동을 패널을 연 화면이 정한다. */
export type PropertyCreationPanel = {
  onClose: () => void;
  onCreated: (propertyId: number) => void;
};

const CreatePropertyPage = ({ panel }: { panel?: PropertyCreationPanel }) => {
  const routeState = (useLocation().state as PropertyCreationRouteState | null) ?? {};
  const keyboardInset = useKeyboardInset();
  const form = usePropertyCreationForm(panel ? {} : routeState, { onCreated: panel?.onCreated });
  const { values, errors, revealedStep, nameStep } = form;
  useEffect(() => {
    if (routeState.fromExploration) trackExplorationRecordView();
  }, [routeState.fromExploration]);
  const isNameStep = revealedStep >= nameStep;
  const Root = panel ? 'div' : 'main';
  const submitOnKeyboardEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  return (
    // 패널로 열면 패널을 연 화면의 main 안에 들어가므로 main을 겹치지 않는다.
    <Root className={styles.page} data-panel={panel ? 'true' : undefined}>
      <div className={styles.content}>
        <TopNavigation
          className={styles.createNavigation}
          title="새 매물 등록"
          backTo={panel ? undefined : '/'}
          onBack={panel?.onClose}
          backLabel="매물 등록 닫기"
          navigationIcon="close"
        />
        {routeState.fromExploration && (
          <p className={styles.stepNotice}>
            찾아본 동네에서 기록을 시작해요. 실제 방문한 방의 위치는 주소 단계에서 확인해주세요.
          </p>
        )}
        <form
          className={styles.formContainer}
          style={{ '--keyboard-inset': `${keyboardInset}px` } as CSSProperties}
          onSubmit={form.submitStep}
        >
          <MoneyField
            label="보증금 입력"
            fieldClassName={styles.depositField}
            fieldSize="large"
            floatingLabel
            placeholder="보증금 입력"
            value={values.depositAmount}
            onValueChange={(value) => form.changeMoney('depositAmount', value)}
            error={errors.depositAmount}
            enterKeyHint="next"
            onKeyDown={submitOnKeyboardEnter}
          />
          {revealedStep >= 1 && (
            <MoneyField
              label="월세 입력"
              fieldClassName={styles.rentField}
              fieldSize="large"
              floatingLabel
              placeholder="월세 입력"
              value={values.monthlyRentAmount}
              onValueChange={(value) => form.changeMoney('monthlyRentAmount', value)}
              error={errors.monthlyRentAmount}
              enterKeyHint="next"
              onKeyDown={submitOnKeyboardEnter}
              autoFocus={revealedStep === 1}
            />
          )}
          {!form.hasPresetLocation && revealedStep >= 2 && (
            <PropertyLocationPicker location={form.location} search={form.search} />
          )}
          {isNameStep && (
            <TextField
              label="매물 이름 입력"
              fieldClassName={styles.nameField}
              fieldSize="large"
              floatingLabel
              placeholder="매물 이름 입력"
              maxLength={30}
              value={values.name}
              onFocus={form.focusName}
              onChange={form.changeName}
              error={errors.name}
              enterKeyHint="done"
              onKeyDown={submitOnKeyboardEnter}
            />
          )}
          {form.createError !== null && (
            <p className={styles.errorNotice} role="alert">
              {form.createError}
            </p>
          )}
          <p className={styles.stepNotice}>
            {stepNotice(revealedStep, isNameStep && form.location.status === 'ready')}
          </p>
          {/* iOS 숫자 키패드에는 확인 키가 없어서, 키패드가 열려 있어도 버튼을 키패드 바로 위에 띄운다. */}
          <BottomActionArea>
            <Button
              variant="primary"
              type="submit"
              fullWidth
              isLoading={form.isCreating}
              // 누를 때 입력칸 포커스를 뺏지 않아 키패드가 닫혔다 열리며 버튼이 튀지 않는다.
              onMouseDown={(event) => event.preventDefault()}
            >
              {isNameStep ? '매물 등록' : '다음'}
            </Button>
          </BottomActionArea>
        </form>
      </div>
    </Root>
  );
};

export default CreatePropertyPage;
