import { create, type StateCreator, type StoreMutatorIdentifier } from 'zustand';


type Api<T> = (this: {
    getState(): T,
    setState(): void
}, ...args: any[]) => any

type ExtendApiMiddleware = <
    T,
    Mps extends [StoreMutatorIdentifier, unknown][] = [],
    Mcs extends [StoreMutatorIdentifier, unknown][] = [],
>(
    initializer: StateCreator<T, Mps, Mcs>,
    api: Record<string, Api<T>>
) => StateCreator<T, Mps, Mcs>;


export const extendApi: ExtendApiMiddleware = (config, apiExtended) => (set, get, api) => {
    const initialState = config(set, get, api)
    // return config(
    //     (...args) => {
    //         console.log('Prev State:', get());
    //         set(...args);
    //         console.log('Next State:', get());
    //     },
    //     get,
    //     api
    // );

    return Object.assign(apiExtended)
};


const test = create(
    extendApi(
        (s, g) => ({}),
        {
            get() {
                this.setState()
            }
        }
    )
)