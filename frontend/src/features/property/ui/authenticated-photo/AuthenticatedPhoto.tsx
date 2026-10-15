import { getPropertyErrorMessage } from '../../api/propertyErrorMessages';
import { useAuthenticatedPhoto } from '../../api/useAuthenticatedPhoto';

import './AuthenticatedPhoto.css';

type AuthenticatedPhotoProps = {
  propertyId: number;
  photoId: number;
  contentUrl: string;
  alt: string;
  className?: string;
  errorMode?: 'message' | 'retry-only';
};

const AuthenticatedPhoto = ({
  propertyId,
  photoId,
  contentUrl,
  alt,
  className = '',
  errorMode = 'message',
}: AuthenticatedPhotoProps) => {
  const photo = useAuthenticatedPhoto(propertyId, photoId, contentUrl);

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

  if (photo.isPending || photo.objectUrl === null) {
    return (
      <div className={`authenticated-photo authenticated-photo--loading ${className}`} role="status">
        <span className="spinner" aria-hidden="true" />
        <span>사진을 불러오는 중</span>
      </div>
    );
  }

  return <img className={`authenticated-photo__image ${className}`} src={photo.objectUrl} alt={alt} />;
};

export default AuthenticatedPhoto;
