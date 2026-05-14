import { create } from "zustand";



type Store = {
    data: string[]
    getData(): Promise<void>
}

export const store = create<Store>((set, get) => ({
    data: [],
    async getData() {

        let res: any, prom = new Promise(r => res = r)
        setTimeout(() => {
            res()
        }, 400);

        await prom
        set({ data: ['a', 'b', 'c'] })

    },
}))