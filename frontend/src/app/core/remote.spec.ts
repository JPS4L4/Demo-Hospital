import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError, toArray } from 'rxjs';
import { Remote, keepPrevious, toRemote } from './remote';

async function collect<T>(source: ReturnType<typeof toRemote<T>>): Promise<Remote<T>[]> {
  return firstValueFrom(source.pipe(toArray()));
}

describe('toRemote', () => {
  it('emits loading then ready with the data', async () => {
    expect(await collect(toRemote(of([1, 2])))).toEqual([
      { status: 'loading' },
      { status: 'ready', data: [1, 2] },
    ]);
  });

  it('maps a 404 to not-found', async () => {
    const err = new HttpErrorResponse({ status: 404 });
    expect(await collect(toRemote(throwError(() => err)))).toEqual([
      { status: 'loading' },
      { status: 'not-found' },
    ]);
  });

  it('maps any other failure to error', async () => {
    const err = new HttpErrorResponse({ status: 0 });
    expect(await collect(toRemote(throwError(() => err)))).toEqual([
      { status: 'loading' },
      { status: 'error' },
    ]);
  });
});

describe('keepPrevious', () => {
  it('keeps the last ready data (marked stale) while the next request loads', () => {
    TestBed.runInInjectionContext(() => {
      const source = signal<Remote<number>>({ status: 'loading' });
      const view = keepPrevious(source);
      expect(view()).toEqual({ status: 'loading' });

      source.set({ status: 'ready', data: 1 });
      expect(view()).toEqual({ status: 'ready', data: 1 });

      source.set({ status: 'loading' });
      expect(view()).toEqual({ status: 'ready', data: 1, stale: true });

      source.set({ status: 'ready', data: 2 });
      expect(view()).toEqual({ status: 'ready', data: 2 });
    });
  });

  it('does not keep stale data across an error', () => {
    TestBed.runInInjectionContext(() => {
      const source = signal<Remote<number>>({ status: 'ready', data: 1 });
      const view = keepPrevious(source);

      source.set({ status: 'error' });
      expect(view()).toEqual({ status: 'error' });

      source.set({ status: 'loading' });
      expect(view()).toEqual({ status: 'loading' });
    });
  });
});
