import { createContext, useContext, type FC, type ReactNode } from "react";
import type { FormControl } from "../createForm";


type Props = {
    control: FormControl
    children: ReactNode
}

type Provide = {
    control: FormControl
}

const Context = createContext<Provide>({} as Provide)
export const useFormProvider = () => useContext(Context)

export const FormProvider: FC<Props> = ({ control, children }) => {

    return (
        <Context.Provider value={{ control }}>
            {children}
        </Context.Provider>
    )

}