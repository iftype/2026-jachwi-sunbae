const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: '2-digit',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** qa/README.md의 `runId` 형식(`YYMMDD-HHmmss`, 한국 시간)으로 만든다. */
export const formatRunId = (date: Date): string => {
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}${parts.second}`;
};

let lastRunId: string | null = null;

/**
 * 같은 프로세스에서 겹치지 않는 `runId`를 만든다.
 * `runId`는 닉네임에 쓰이므로 같은 초에 두 실행이 시작되면 같은 회원을 공유하게 된다. 이때는 다음 초까지 기다린다.
 */
export const nextRunId = async (): Promise<string> => {
  let runId = formatRunId(new Date());
  while (runId === lastRunId) {
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    runId = formatRunId(new Date());
  }
  lastRunId = runId;
  return runId;
};
