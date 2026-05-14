import { create } from "zustand"
import type { FieldSchema, FieldState } from "./types/field";
import { fieldTypesMap, required, type FieldTypes } from "./config";
import { subscribeWithSelector } from "zustand/middleware";
import { _formMethods } from "./methods/form";
import { _hookMethods } from "./methods/hook";
import { _validationMethods } from "./methods/validation";
import { _fieldMethods } from "./methods/field";


const $SCHEMA: unique symbol = Symbol('schema')
const $HAS_ERRORS: unique symbol = Symbol('has_errors')
const $ERRORS: unique symbol = Symbol('errors')
const $VALID: unique symbol = Symbol('valid')
const $VALUES: unique symbol = Symbol('values')
const $FIELD_DEPS: unique symbol = Symbol('field_deps')
const $INITIALIZED: unique symbol = Symbol('initialized')


type Rec = Record<string, any>
type Errors = Record<string, Record<string, string>>

type FormState = {
    [$SCHEMA]: Record<string, FieldSchema>,
    [$VALUES]: Rec,
    [$FIELD_DEPS]: Record<string, Set<string>>
    // [$INITIALIZED]: boolean,
    [$VALID]: boolean,
    [$ERRORS]: null | Errors,
    [$HAS_ERRORS]: boolean,
} & {
    [key: string]: FieldState
}


type FormStateMap = {
    valid: boolean
    errors: null | Errors
    hasErrors: boolean
}


type FormStateUpdate = {
    valid?: boolean
    errors?: any
    hasErrors?: boolean
}



interface GetSchema {
    (id: string): FieldSchema
    (): Record<string, FieldSchema>
}

interface SetField {
    (id: string, partial: Partial<FieldState>): void
    (id: string, partial: (prev: FieldState) => FieldState): void
}

type Watch = <T>(to: 'values' | 'valid' | 'errors' | 'has_errors', callback: (state: T, prevState: T) => void) => () => void

type RuleTest = Record<string, 'pass' | 'failed'>
type ApplyRules = (field: FieldState, value?: any) => [FieldState, RuleTest]
type HandleRulesDeps = (id: string, schema: FieldSchema) => () => void

type FormApi = {
    get: () => Rec;
    set: (id: string, value: any) => void;
    reset: () => void
    setField: SetField
    getField: (id: string) => FieldState | undefined;
    getSchema: GetSchema
    applyRules: ApplyRules
    setState: (update: FormStateUpdate, replace?: boolean) => void;
    getState: () => void;
    getFormState: () => FormStateMap
    register: (id: string, config: FieldSchema) => void
    handleRulesDeps: HandleRulesDeps
    getDeps(id: string): Set<string> | void
    watch: Watch
    map: (fn: (field: FieldState & { id: string }) => Partial<FieldState>) => void
}

export type FormControl = FormApi & {
    (selector?: (state: Record<string, FieldState>) => void): FieldState,
}

type Schema<T extends Record<string, FieldTypes>> = { [K in keyof T]: FieldSchema<T[K], T> }

type Values<T extends Record<string, FieldTypes>> = { [K in keyof T]: ReturnType<T[K]> }
// type LooseKeys<T> = keyof T | (string & {})



class StoreMethods<
    T extends FormState,
    S extends (partial: FormState | Partial<FormState> | ((state: FormState) => FormState | Partial<FormState>), replace?: boolean) => void,
    G extends () => T
> {

    constructor(
        private _set: S,
        private _get: G,
        private _api: any
    ) {
        // Autodiscovery: prende tutti i metodi definiti nella classe 
        // e li inietta nell'API di Zustand automaticamente.
        const prototype = Object.getPrototypeOf(this);
        const methodNames = Object.getOwnPropertyNames(prototype);

        for (const key of methodNames) {
            if (key !== 'constructor' && typeof (this as any)[key] === 'function') {
                this._api[key] = (this as any)[key].bind(this);
            }
        }
    }

    getSchema(id?: string) {
        const schema = this._get()[$SCHEMA];
        if (id) return schema[id];
        return schema;
    }

    getField(id: string) {
        return this._get()[id];
    }

    applyRules(field: FieldState, value?: any): [FieldState, RuleTest] {
        if (!field) return [{} as FieldState, {}];

        const { rules, ...currState } = field;
        let nextState: FieldState = { ...currState };
        let message: string[] = [];
        let ruleTest: Record<string, 'pass' | 'failed'> = {};

        nextState.error = false;

        if (rules) {
            for (const [name, rule] of Object.entries(rules)) {
                // Nota: usiamo this.get() invece di get()
                const ret = rule(value ?? field.value, this.get());

                if (typeof ret === 'object') {
                    if (ret.message) message.push(ret.message);
                    nextState = {
                        ...nextState,
                        ...ret as any,
                        error: nextState.error || ret?.error
                    };
                    ruleTest[name] = ret.error ? 'failed' : 'pass';
                } else {
                    const invalid = ret;
                    nextState.error = nextState.error || invalid;
                    ruleTest[name] = invalid ? 'failed' : 'pass';
                }
            }
        }

        if (nextState.required) {
            const ret = required(nextState.type, value ?? field.value);
            nextState.error = nextState.error || ret.error;
            if (ret.message) message.push(ret.message);
            ruleTest.required = ret.error ? 'failed' : 'pass';
        }

        if (nextState.disabled) {
            nextState.error = false;
        }

        nextState.message = message;
        return [Object.assign({ rules }, nextState), ruleTest];
    }

    setField(id: string, update: any) {
        const fieldSchema = this.getSchema(id);

        if (!fieldSchema) {
            console.error(`${id} is not registered`);
            return;
        }

        if (typeof update === 'function') {
            update = update(this.getField(id) ?? {});
        } else {
            const field = this.getField(id) ?? {};
            update = { ...field, ...update };
        }

        const [nextState, ruleTest] = this.applyRules(update as FieldState);
        const values = this._get()[$VALUES];
        values[id] = fieldTypesMap.get(nextState.type)?.convert(update.value);

        this._set((prev) => {
            let nextErrors: Errors | null = { ...(prev[$ERRORS] ?? {}) };
            const fieldError = nextState.error;
            const ruleErrors = { [id]: ruleTest };

            if (fieldError) {
                nextErrors = Object.assign(nextErrors, ruleErrors);
            } else {
                delete nextErrors[id];
            }

            if (Object.keys(nextErrors).length === 0) nextErrors = null;

            return {
                ...prev,
                [id]: { ...nextState },
                [$VALUES]: { ...values },
                [$HAS_ERRORS]: prev[$HAS_ERRORS] || fieldError,
                [$ERRORS]: nextErrors
            };
        });

        const deps = this.getDeps(id);
        if (deps) {
            for (const dep of deps) {
                this.setField(dep, {});
            }
        }
    }

    get() {
        return this._get()[$VALUES];
    }

    set(id: string, value: any) {
        this.setField(id, { value });
    }

    register(id: string, config: FieldSchema) {
        if (!config.type) {
            console.error(`[createForm] - register(${id}, { type: 'is required' })`);
            return;
        }

        this._set((prev: any) => {
            const schema = prev[$SCHEMA] as Record<string, FieldSchema>;
            const values = prev[$VALUES];
            schema[id] = config;
            values[id] = undefined;
            return {
                ...prev,
                [id]: undefined,
            };
        });

        const value = this.getField(id)?.value;
        this.setField(id, {
            ...config,
            value: value ?? fieldTypesMap.get(config.type)?.initValue()
        });
    }

    setState(update: FormStateUpdate, replace?: boolean) {
        // @ts-ignore
        this._set({
            [$VALID]: update.valid ?? false,
            [$ERRORS]: update.errors ?? null,
            [$HAS_ERRORS]: update.hasErrors ?? false,
        }, replace);
    }

    getState() {
        return this._get();
    }

    reset() {
        // Assicurati che 'state' sia referenziabile o ricostruibile se necessario
        // this._set(initialState, true)
    }

    getDeps(id: string) {
        return this._get()[$FIELD_DEPS][id];
    }

    handleRulesDeps(id: string, schema: any) {
        const CURR_DEPS_ID = `$$${id}`;
        const field_deps = this._get()[$FIELD_DEPS];
        const { type, rules, deps } = schema;
        let _deps = new Set<string>();

        if (deps) {
            _deps = new Set(deps.filter((dep: string) => dep !== id));
        } else if (rules) {
            const trap = new Proxy({}, {
                get(_target: any, key: string) {
                    if (key !== id) _deps.add(key);
                    return null;
                }
            });

            try {
                const test = fieldTypesMap.get(type)?.test ?? [];
                for (const rule of Object.values(rules)) {
                    test.forEach((testValue: any) => (rule as Function)(testValue, trap));
                }
            } catch {
                console.warn(`[createForm] - failed to estimate ${id} rules deps`);
            }
        }

        for (const dep of _deps) {
            if (!field_deps[dep]) field_deps[dep] = new Set();
            field_deps[dep].add(id);
        }

        field_deps[CURR_DEPS_ID] = _deps;
        this._set({ [$FIELD_DEPS]: { ...field_deps } });

        return () => {
            const map = this._get()[$FIELD_DEPS];
            const depsToClean = map?.[CURR_DEPS_ID];

            if (depsToClean) {
                for (const dep of depsToClean) {
                    if (map[dep]) map[dep].delete(id);
                }
                delete map[CURR_DEPS_ID];
                this._set({ [$FIELD_DEPS]: { ...map } });
            }
        };
    }

    watch(to: 'values' | 'valid' | 'errors' | 'has_errors', callback: any) {
        const symbolMap = {
            valid: $VALID,
            values: $VALUES,
            errors: $ERRORS,
            has_errors: $HAS_ERRORS
        };
        const key = symbolMap[to] as keyof FormState;
        if (!key) return () => void (0);

        return this._api.subscribe((state: any) => state[key], callback);
    }

    map(fn: (field: FieldState & { id: string }) => Partial<FieldState>) {
        for (const id of Object.keys(this.getSchema())) {
            const currState = Object.assign(this.getField(id), { id });
            const ret = fn(currState) as FieldState & { id: string };
            const { id: _, ...nextState } = ret;
            this.setField(id, nextState);
        }
    }

    getFormState(): FormStateMap {
        const state = this._get();
        return {
            valid: state[$VALID],
            errors: state[$ERRORS],
            hasErrors: state[$HAS_ERRORS],
        };
    }
}



export const createForm = <S extends Record<string, FieldTypes>>(
    schema?: Schema<S>
) => {

    const formState = create(subscribeWithSelector<FormState>((_set, _get, _api) => {

        const state: FormState = {
            // [$INITIALIZED]: false,
            [$SCHEMA]: (schema as any) ?? {},
            [$VALUES]: {},
            [$FIELD_DEPS]: {},
            [$VALID]: false,
            [$ERRORS]: null,
            [$HAS_ERRORS]: false,
        }

        if (schema) {
            for (const [id, config] of Object.entries(schema)) {

                state[id] = {
                    ...config,
                    value: (config as FieldSchema)?.initValue ?? fieldTypesMap.get(config.type)?.initValue()
                }

                const { value } = state[id]
                state[$VALUES][id] = value
            }

            // console.log('initial data', state)
        }

        const getSchema = (id?: string) => {
            const schema = _get()[$SCHEMA]
            if (id) return schema[id]
            return schema
        }

        const getField = (id: string) => {
            return _get()[id]
        }


        const applyRules: ApplyRules = (field, value) => {

            if (!field) {
                return [{}, {}] as [FieldState, RuleTest]
            }

            const { rules, ...currState } = field

            let nextState: FieldState = { ...currState }
            let message: string[] = []
            let ruleTest: Record<string, 'pass' | 'failed'> = {}

            nextState.error = false

            if (rules) {

                for (const [name, rule] of Object.entries(rules)) {

                    const ret = rule(value ?? field.value, get())

                    if (typeof ret === 'object') {

                        if (ret.message) {
                            message.push(ret.message)
                        }

                        nextState = {
                            ...nextState,
                            ...ret as any,
                            error: nextState.error || ret?.error
                        }

                        ruleTest[name] = ret.error ? 'failed' : 'pass'


                    } else {
                        const invalid = ret
                        nextState.error = nextState.error || invalid
                        ruleTest[name] = invalid ? 'failed' : 'pass'
                    }
                }
            }

            if (nextState.required) {
                const ret = required(nextState.type, value ?? field.value)

                nextState.error = nextState.error || ret.error
                if (ret.message) message.push(ret.message)
                ruleTest.required = ret.error ? 'failed' : 'pass'
            }


            if (nextState.disabled) {
                nextState.error = false
            }

            nextState.message = message


            return [Object.assign({ rules }, nextState), ruleTest]
        }


        const setField: SetField = (id, update) => {

            const fieldSchema = getSchema(id)

            if (!fieldSchema) {
                console.error(`${id} is not registered`)
                return
            }

            if (typeof update === 'function') {
                // override
                update = update(getField(id) ?? {})
            } else {

                const field = getField(id) ?? {}

                update = {
                    ...field,
                    ...update,
                }
            }

            const [nextState, ruleTest] = applyRules(update as FieldState)

            const values = _get()[$VALUES]
            values[id] = fieldTypesMap.get(nextState.type)?.convert(update.value)

            _set((prev) => {

                let nextErrors: Errors | null = { ...(prev[$ERRORS] ?? {}) }
                const fieldError = nextState.error
                const ruleErrors = { [id]: ruleTest }


                if (fieldError) {
                    nextErrors = Object.assign(nextErrors, ruleErrors)
                } else {
                    delete nextErrors[id]
                }

                if (Object.keys(nextErrors).length === 0) {
                    nextErrors = null
                }

                return {
                    ...prev,
                    [id]: { ...nextState },
                    [$VALUES]: { ...values },
                    [$HAS_ERRORS]: prev[$HAS_ERRORS] || fieldError,
                    [$ERRORS]: nextErrors
                }
            })

            const deps = api.getDeps(id)
            if (deps) {

                for (const dep of deps) {
                    api.setField(dep, {})
                }
            }

        }


        const get = () => _get()[$VALUES]

        const set = (id: string, value: any) => {
            setField(id, { value })
        }

        const register = (id: string, config: FieldSchema) => {

            if (!config.type) {
                console.error(`[createForm] - register(${id}, { type: 'is required' })`)
                return
            }

            _set(prev => {
                const schema = prev[$SCHEMA] as Record<string, FieldSchema>
                const values = prev[$VALUES]
                schema[id] = config;
                values[id] = undefined
                return {
                    ...prev,
                    [id]: undefined,
                }
            })

            const value = getField(id)?.value

            setField(id, {
                ...config,
                value: value ?? fieldTypesMap.get(config.type)?.initValue()
            })

            // console.log(getField(id))

        }


        const setState = (update: FormStateUpdate, replace?: boolean) => {

            // @ts-ignore
            _set({
                // [$INITIALIZED]: update.inizialized ?? false,
                [$VALID]: update.valid ?? false,
                [$ERRORS]: update.errors ?? null,
                [$HAS_ERRORS]: update.hasErrors ?? false,
            }, replace)
        }

        const getState = () => {

            return _get()
        }

        const reset = () => {

            _set(state, true)
        }

        const getDeps = (id: string) => _get()[$FIELD_DEPS][id]

        const handleRulesDeps: HandleRulesDeps = (id, schema) => {

            const CURR_DEPS_ID = `$$${id}`

            const field_deps = _get()[$FIELD_DEPS]

            const { type, rules, deps } = schema

            let _deps = new Set<string>()

            if (deps) {

                // filtro l'id se coincide con lo stesso campo
                _deps = new Set(deps.filter(dep => dep !== id))

            } else if (rules) {

                const trap = new Proxy({}, {
                    get(_target: any, key: string) {

                        if (key !== id) {
                            _deps.add(key)
                        }

                        return null
                    }
                })

                try {

                    const test = fieldTypesMap.get(type)?.test ?? []

                    for (const rule of Object.values(rules)) {
                        test.forEach(testValue => rule(testValue, trap))
                    }

                } catch {
                    console.warn(`[createForm] - failed to estimate ${id} rules deps`)
                }

            } // end rules

            for (const dep of _deps) {

                if (!field_deps[dep]) {
                    field_deps[dep] = new Set()
                }

                const set = field_deps[dep]
                set.add(id)

            }

            field_deps[CURR_DEPS_ID] = _deps

            _set({ [$FIELD_DEPS]: { ...field_deps } })

            return () => {
                // clean dependency on unmount
                const map = _get()[$FIELD_DEPS]
                const deps = map?.[CURR_DEPS_ID]

                if (deps) {

                    for (const dep of deps) {
                        const set = map[dep]
                        if (set) {
                            set.delete(id)
                        }
                    }

                    delete map[CURR_DEPS_ID]

                    _set({ [$FIELD_DEPS]: { ...map } })

                    // console.log(_get()[$FIELD_DEPS])
                }
            }

        }

        const watch: Watch = (to, callback) => {

            const symbolMap = {
                valid: $VALID,
                values: $VALUES,
                errors: $ERRORS,
                has_errors: $HAS_ERRORS
            }

            const key = symbolMap[to] as keyof FormState

            if (!key) return () => void (0)

            return _api.subscribe<any>(state => state[key], callback)

        }


        const map = (fn: (field: FieldState & { id: string }) => Partial<FieldState>) => {

            for (const id of Object.keys(getSchema())) {
                const currState = Object.assign(getField(id), { id })

                const ret = fn(currState) as FieldState & { id: string }
                const { id: _, ...nextState } = ret;

                setField(id, nextState)
            }
        }


        const getFormState = (): FormStateMap => {
            const state = _get()
            // console.log(state)
            return {
                valid: state[$VALID],
                errors: state[$ERRORS],
                hasErrors: state[$HAS_ERRORS],
            }
        }


        const api = {
            getSchema,
            setState,
            getState,
            reset,
            get,
            set,
            setField,
            getField,
            register,
            getDeps,
            applyRules,
            handleRulesDeps,
            getFormState,
            watch,
            map
        }

        Object.assign(_api, api)

        return state
    })) as unknown as FormControl

    const getters = formState.getFormState()



    const methods = new Proxy(
        Object.assign(
            _formMethods<Schema<S>, Values<S>>(formState),
            _hookMethods<{ [K in keyof S]: ReturnType<S[K]> }, S>(formState),
            _validationMethods(formState),
            _fieldMethods<Values<S>>(formState)
        ),
        {
            get(t, prop, receiver) {
                if (prop in getters) {
                    return formState.getFormState()[prop as keyof FormStateMap]
                }
                return Reflect.get(t, prop, receiver)
            }
        }
    )

    // console.log(methods)


    return {
        ...getters,
        ...methods,
        control: formState
    }
}