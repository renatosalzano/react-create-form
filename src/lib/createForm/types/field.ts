import type { FieldTypes } from "../config";

type Rec = Record<string, any>
type TypeRec = Record<string, FieldTypes>

type FieldType<T> = T extends FieldTypes ? ReturnType<T> : T


export type FieldSchema<
    T extends FieldTypes = FieldTypes,
    V = {}
> = {
    type: T
    value?: FieldType<T>
    required?: boolean
    disabled?: boolean
    rules?: Record<string, Rule<FieldType<T>, V>>
    deps?: (keyof V | (string & {}))[]
}


export type Rule<
    T,
    V = {}
> = (
    value: T | null | undefined,
    deps: { [K in keyof V]: FieldType<V[K]> }
) => boolean | {
    error: boolean
    message?: string
    disabled?: boolean
    readonly?: boolean
}


export type FieldProps = {
    error?: boolean
    required?: boolean
    disabled?: boolean
    readonly?: boolean
}


export type FieldState<T = any> = FieldProps & {
    value: T
    // deps?: string[]
    touched?: boolean
    mounted?: boolean
    message?: string[]
}