import { useLayoutEffect, useMemo, useState } from "react";
import type { FormControl } from "../createForm";


type SuggestKeys<T> = keyof T | (string & {});
type Values<T> = { [K in SuggestKeys<T>]: K extends keyof T ? T[K] : string };


export const _hookMethods = <S>(api: FormControl) => {


    const useValues = <
        T = S,
        R = Values<T>
    >(
        selector?: (state: Values<T>) => R
    ) => {

        const _selector = useMemo(() => {
            return selector || ((s: Values<T>) => s as unknown as R);
        }, [selector]);

        const [state, setState] = useState<R>(() => _selector(api.get() as any));

        useLayoutEffect(() => {
            const unsub = api.watch('values', (curr: Values<T>) => {
                const nextState = _selector(curr);
                setState(() => nextState)
            });

            return () => unsub();
        }, [_selector]);

        return state
    };
    return {
        useValues
    }
}