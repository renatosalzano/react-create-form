import type { FC, ReactNode } from "react"
import { useControl } from "../hook/useControl"
import type { FormControl } from ".."
import type { FieldProps, FieldSchema, FieldState } from "../types/field"

type Props = {
    id: string
    control?: FormControl
    register?: FieldSchema
    input: (props: InputProps) => ReactNode
} & FieldProps

type InputProps = {
    id: string
    value: any
    error?: boolean
    disabled?: boolean
    onChange(evt: any): void
}

export const Control: FC<Props> = ({
    id,
    control,
    register,
    input,
    ...override
}) => {

    const { render, field } = useControl({
        id,
        control,
        register,
        field: override
    })

    // console.log(id, field)

    if (!render) return null

    return input(field)

}