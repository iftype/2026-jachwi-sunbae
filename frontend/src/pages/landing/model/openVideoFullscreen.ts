type FullscreenVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

/** 부스처럼 큰 화면에서 소개 영상을 크게 틀 수 있게, 영상을 누르면 전체 화면으로 연다. */
export const openVideoFullscreen = (video: FullscreenVideo) => {
  if (document.fullscreenElement) return;
  if (typeof video.requestFullscreen === 'function') {
    video.requestFullscreen().catch(() => undefined);
    return;
  }
  // iOS Safari는 요소 전체 화면이 없고 video 전용 전체 화면만 있다.
  video.webkitEnterFullscreen?.();
};
