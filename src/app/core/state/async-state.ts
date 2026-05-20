export type AsyncState<T> =
  | { kind: 'loading' }
  | { kind: 'data'; value: T }
  | { kind: 'error'; message: string };

export const AsyncState = {
  loading<T>(): AsyncState<T> { return { kind: 'loading' }; },
  data<T>(value: T): AsyncState<T> { return { kind: 'data', value }; },
  error<T>(message: string): AsyncState<T> { return { kind: 'error', message }; },
  valueOrNull<T>(s: AsyncState<T>): T | null { return s.kind === 'data' ? s.value : null; },
  isLoading<T>(s: AsyncState<T>): boolean { return s.kind === 'loading'; },
};
