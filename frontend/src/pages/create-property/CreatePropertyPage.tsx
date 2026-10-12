import type { CSSProperties, KeyboardEvent } from 'react';
import { useLocation } from 'react-router-dom';

import MoneyField from '@/features/property/ui/money-field/MoneyField';
import useIsMobileViewport from '@/shared/lib/hooks/useIsMobileViewport';
import { useKeyboardInset } from '@/shared/lib/hooks/useKeyboardInset';
import BottomActionArea from '@/shared/ui/bottom-action-area/BottomActionArea';
import { Button } from '@/shared/ui/button/Button';
import TextField from '@/shared/ui/text-field/TextField';
import TopNavigation from '@/shared/ui/top-navigation/TopNavigation';

import { type PropertyCreationRouteState, usePropertyCreationForm } from './hooks/usePropertyCreationForm';
import PropertyLocationPicker from './ui/property-location-picker/PropertyLocationPicker';

import styles from './CreatePropertyPage.module.css';

const stepNotice = (revealedStep: number, isReadyToSubmit: boolean, isMobileViewport: boolean) => {
  if (isReadyToSubmit) return '필수 정보를 모두 입력했다면 매물을 등록해 주세요.';
  const action = isMobileViewport ? '키패드의 확인을 눌러 주세요.' : '다음을 눌러 주세요.';
  if (revealedStep === 0) return `보증금을 입력한 뒤 ${action}`;
  if (revealedStep === 1) return `월세를 입력한 뒤 ${action}`;
  return '위치를 선택한 뒤 다음을 눌러 주세요.';
};

const CreatePropertyPage = () => {
  const routeState = (useLocation().state as PropertyCreationRouteState | null) ?? {};
  const isMobileViewport = useIsMobileViewport();
  const keyboardInset = useKeyboardInset();
  const form = usePropertyCreationForm(routeState);
  const { values, errors, revealedStep, nameStep } = form;
  const isNameStep = revealedStep >= nameStep;
  const submitOnKeyboardEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <TopNavigation
          className={styles.createNavigation}
          title="새 매물 등록"
          backTo="/properties"
          backLabel="매물 등록 닫기"
          navigationIcon="close"
        />
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
            {stepNotice(revealedStep, isNameStep && form.location.status === 'ready', isMobileViewport)}
          </p>
          {keyboardInset === 0 && (isNameStep || revealedStep >= 2 || !isMobileViewport) && (
            <BottomActionArea>
              <Button variant="primary" type="submit" fullWidth isLoading={form.isCreating}>
                {isNameStep ? '매물 등록' : '다음'}
              </Button>
            </BottomActionArea>
          )}
        </form>
      </div>
    </main>
  );
};

export default CreatePropertyPage;
