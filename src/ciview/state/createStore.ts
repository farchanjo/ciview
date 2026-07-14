import { BehaviorSubject } from "rxjs";

export function createStore<T>(initial: T) {
  const subject = new BehaviorSubject<T>(initial);
  return {
    get: () => subject.getValue(),
    set: (next: T | ((prev: T) => T)) => {
      const value = typeof next === "function" ? (next as (p: T) => T)(subject.getValue()) : next;
      subject.next(value);
    },
    patch: (partial: Partial<T>) => {
      subject.next({ ...subject.getValue(), ...partial });
    },
    subscribe: (fn: (v: T) => void) => {
      const sub = subject.subscribe(fn);
      return () => sub.unsubscribe();
    },
    $: subject.asObservable(),
  };
}

export type Store<T> = ReturnType<typeof createStore<T>>;
