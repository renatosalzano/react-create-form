import { useLayoutEffect, useMemo, useRef, useState } from "react"
import { useFormProvider } from "../components/FormProvider"
import type { FormControl } from "../createForm"
import type { FieldProps, FieldSchema } from "../types/field"
import { schemasEqual } from "../utils/schemasEqual"
import { isInputEvent } from "../utils/isInputEvent"
import { fieldTypesMap } from "../config"

type ControlProps = {
    id: string
    control?: FormControl
    register?: FieldSchema
    field?: FieldProps
}


const safe = <T>(methods: T, id: string): T => {

    if (methods) return methods;

    const noop = () => { };

    const proxyHandler: ProxyHandler<any> = {
        get(t, k) {
            return new Proxy(noop, proxyHandler);
        },
        apply() {
            console.warn(`[useControl] - id: '${id}' control is not defined`);
            return undefined;
        }
    };

    return new Proxy(noop, proxyHandler) as unknown as T;
}


export const useControl = (props: ControlProps) => {

    const { id } = props

    const provider = useFormProvider()

    const api = safe(props.control ?? provider.control, id)

    const controlNotDefined = useMemo(() => !props.control && !provider.control, [props.control, provider.control])

    const schema = useMemo(() => {
        // console.log('schema', id)

        const ret = api.getSchema(id) ?? props.register
        if (!ret) {
            console.warn(`[useControl] - id: "${id}" is not registered`)
        } else {

            if (props.register && !schemasEqual(props.register, api.getSchema(id))) {

                return props.register
            }
        }
        return ret
    }, [props.id, props.register, props.register?.rules])


    const typeApi = useMemo(() => {
        if (schema) {
            const typeApi = fieldTypesMap.get(schema.type)
            if (typeApi) return typeApi
        }
        return fieldTypesMap.get(String)!
    }, [schema])

    const mount = useRef<boolean>(null)
    const [render, setRender] = useState(false)

    const field = api(state => state[id]) ?? {}


    const onChange = (evt: any) => {

        let value = evt

        if (isInputEvent(evt)) {
            value = evt.target.value

            if (evt.target.type === 'checkbox') {

                const hasValue = !['true', 'false'].includes(evt.target.value)

                if (hasValue) {
                    value = evt.target.checked ? evt.target.value : ""
                } else {
                    value = evt.target.checked
                }
            }

            value = typeApi.convert(value)
        } else {

            if (!typeApi.checkValue(value)) {
                console.warn(`[useControl] - ${id} value not match`)
            }
        }

        api.setField(
            id,
            {
                value,
                touched: true
            }
        )
        // console.log(id, 'deps:', deps)
    }

    useLayoutEffect(() => {

        mount.current = !controlNotDefined && !!schema
        setRender(!controlNotDefined && !!schema)

        api.register(id, schema)
        // const cleanDeps = api.handleRulesDeps(id, schema)

        return () => {
            !controlNotDefined && api.cleanDeps(id)
        }

    }, [schema, controlNotDefined])


    return {
        type: schema?.type,
        touched: field.touched,
        messages: field.message,
        render: render,
        field: {
            id,
            value: field.value,
            error: field.touched && field.error,
            disabled: field.disabled,
            readOnly: field.readonly,
            onChange
        }
    }

}

