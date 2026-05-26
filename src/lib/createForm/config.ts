import { is } from "./utils/is"


const Types = [
    [String, {
        initValue: (value: any = "") => value,
        checkValue: (value: any) => typeof value === "string",
        convert: (value: any) => is.undefined(value) ? "" : value
    }],
    [Number, {
        initValue: (value: any = "") => value,
        checkValue: (value: any) => {
            if (value) {
                return !isNaN(Number(value))
            }
            return true
        },
        convert: (value: any) => {
            const num = Number(value)
            return (isNaN(num) || value === "") ? null : num
        }
    }],
    [Boolean, {
        initValue: (value: any = false) => value,
        checkValue: (value: any) => typeof value === "boolean",
        convert: (value: any) => !!value
    }],
    [Date, {
        initValue: (value: any = "") => value,
        checkValue: (value: any) => {
            if (is.undefined(value)) return false
            const valid = !isNaN(new Date(value).getTime())
            return valid
        },
        convert: (value: any) => String(value)
    }]
] as const


type types = (typeof Types)[number]
type FieldTypes = types[0]
type TypesMethods = types[1]


const fieldTypesMap = new Map<FieldTypes, TypesMethods>(Types)


const required = (type: FieldTypes, value: any) => {
    let error = false
    switch (type) {
        case Number:
            error = value === null || value === ""
            break
        case Boolean:
            error = false
            break
        case String:
        case Date:
        default:
            error = value === ""
            break
    }

    return {
        error,
        message: error ? 'è obbligatorio' : undefined
    }
}


export type {
    FieldTypes
}

export {
    fieldTypesMap,
    required
}