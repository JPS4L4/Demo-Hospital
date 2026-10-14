import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, of, throwError, toArray } from 'rxjs';
import { Remote, toRemote } from './remote';

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
