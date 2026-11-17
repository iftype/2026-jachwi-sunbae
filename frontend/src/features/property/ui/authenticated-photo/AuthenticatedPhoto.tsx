import { injectGlobal } from '@emotion/css';

import useDelayedLoading from '@/shared/lib/hooks/useDelayedLoading';

import { getPropertyErrorMessage } from '../../api/propertyErrorMessages';
import { useAuthenticatedPhoto } from '../../api/useAuthenticatedPhoto';

type AuthenticatedPhotoProps = {
  propertyId: number;
  photoId: number;
  contentUrl: string;
  kind?: 'original' | 'thumbnail';
  alt: string;
  className?: string;
  errorMode?: 'message' | 'retry-only';
};

const AuthenticatedPhoto = ({
  propertyId,
  photoId,
  contentUrl,
  kind = 'original',
  alt,
  className = '',
  errorMode = 'message',
}: AuthenticatedPhotoProps) => {
  const photo = useAuthenticatedPhoto(propertyId, photoId, contentUrl, kind);
  const isWaiting = photo.isPending || photo.objectUrl === null;
  // 금방 받은 사진은 로딩 문구 없이 같은 크기의 빈 칸에서 바로 바뀌고, 오래 걸릴 때만 스피너와 문구를 보여 준다.
  const isLoadingVisible = useDelayedLoading(isWaiting);

  if (photo.isError) {
    return (
      <div
        className={`authenticated-photo authenticated-photo--error ${errorMode === 'retry-only' ? 'authenticated-photo--retry-only' : ''} ${className}`}
        role="group"
        aria-label={`${alt} 불러오기 실패`}
      >
        {errorMode === 'message' && <span>{getPropertyErrorMessage(photo.error)}</span>}
        <button
          type="button"
          className="inline-button"
          // 아이콘만 보이는 재시도 버튼에만 읽을 이름을 붙인다.
          aria-label={errorMode === 'retry-only' ? `${alt} 새로고침` : undefined}
          onClick={() => void photo.refetch()}
        >
          {errorMode === 'retry-only' ? '🔄' : '다시 시도'}
        </button>
      </div>
    );
  }

  // objectUrl 비교는 isWaiting에 이미 들어 있지만, 아래에서 주소가 있다고 좁히려고 함께 적는다.
  if (isWaiting || isLoadingVisible || photo.objectUrl === null) {
    return isLoadingVisible ? (
      <div className={`authenticated-photo authenticated-photo--loading ${className}`} role="status">
        <span className="spinner" aria-hidden="true" />
        <span>사진을 불러오는 중</span>
      </div>
    ) : (
      <div className={`authenticated-photo ${className}`} aria-hidden="true" />
    );
  }

  return <img className={`authenticated-photo__image ${className}`} src={photo.objectUrl} alt={alt} />;
};

injectGlobal`
.authenticated-photo,
.authenticated-photo__image {
  display: grid;
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: var(--radius-md);
}

.authenticated-photo {
  align-content: center;
  justify-items: center;
  gap: 0.55rem;
  padding: 0.7rem;
  background: var(--color-surface-muted);
  color: var(--color-ink-soft);
  font-size: 0.75rem;
  text-align: center;
}

.authenticated-photo__image {
  object-fit: cover;
  background: var(--color-surface-muted);
}

.authenticated-photo--error {
  border: 1px solid color-mix(in srgb, var(--color-error) 28%, transparent);
  background: var(--color-error-surface);
  color: var(--color-error);
}

.authenticated-photo--retry-only {
  border: 0;
  background: var(--color-surface-muted);
  color: var(--color-ink-soft);
}

.authenticated-photo--retry-only .inline-button {
  min-height: 2rem;
  padding: 0.25rem 0.5rem;
  text-decoration: none;
}
`;

export default AuthenticatedPhoto;
