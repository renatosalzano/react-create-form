import { create } from "zustand"
import type { FieldSchema, FieldState } from "./types/field";
import { fieldTypesMap, required, type FieldTypes } from "./config";
import { subscribeWithSelector } from "zustand/middleware";
import { _formMethods } from "./methods/form";
import { _hookMethods } from "./methods/hook";
import { _validationMethods } from "./methods/validation";
import { _fieldMethods } from "./methods/field";
import { clone, cloneAndFreeze } from "./utils/clone";


const $SCHEMA: unique symbol = Symbol('schema')
const $HAS_ERRORS: unique symbol = Symbol('has_errors')
const $ERRORS: unique symbol = Symbol('errors')
const $VALID: unique symbol = Symbol('valid')
const $VALUES: unique symbol = Symbol('values')
const $FIELD_DEPS: unique symbol = Symbol('field_deps')
// const $INITIALIZED: unique symbol = Symbol('initialized')


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


type RuleTest = Record<string, 'pass' | 'failed'>


type Schema<T extends Record<string, FieldTypes>> = { [K in keyof T]: FieldSchema<T, T[K]> }

type Values<T extends Record<string, FieldTypes>> = { [K in keyof T]: ReturnType<T[K]> }

type Setter<T> = (partial: T | Partial<T> | ((state: T) => T | Partial<T>), replace?: boolean) => void
type Getter<T> = () => T



class StoreMethods {


    private _initialState: FormState

    constructor(
        private _set: Setter<FormState>,
        private _get: Getter<FormState>,
        private _api: any,
        private _state?: FormState
    ) {

        this._initialState = cloneAndFreeze(this._state!)

        const prototype = Object.getPrototypeOf(this);
        const methodNames = Object.getOwnPropertyNames(prototype);

        for (const key of methodNames) {
            if (key === 'constructor') continue
            if (key.startsWith('_')) continue
            if (typeof (this as any)[key] === 'function') {
                this._api[key] = (this as any)[key].bind(this);
            }
        }
    }

    getSchema(): Record<string, FieldSchema>
    getSchema(id: string): FieldSchema | undefined
    getSchema(id?: string): Record<string, FieldSchema> | FieldSchema | undefined {
        const schema = this._get()[$SCHEMA]
        if (id) return schema[id]
        return schema
    }

    getField(id: string) {
        return this._get()[id];
    }

    applyRules(id: string, update: FieldState): [FieldState, RuleTest] {

        const schema = this.getSchema(id)!

        const { type, rules } = schema;

        let nextState: FieldState = { ...update };
        let message: string[] = [];
        let ruleTest: Record<string, 'pass' | 'failed'> = {};

        let hasError = false;
        let shouldDisable = false;
        const accumulatedProps = {};

        if (rules) {

            for (const [name, rule] of Object.entries(rules)) {

                const ret = rule(update.value, this._interceptDeps(id));

                if (typeof ret === 'object') {

                    if (ret.message) message.push(ret.message);

                    Object.assign(accumulatedProps, ret)

                    if (ret.error !== undefined) hasError = hasError || ret.error;
                    if (ret.disabled !== undefined) shouldDisable = shouldDisable || ret.disabled;

                    ruleTest[name] = ret.error ? 'failed' : 'pass';
                } else {
                    const valid = ret;
                    hasError = !valid
                    nextState.error = hasError || !valid;
                    ruleTest[name] = valid ? 'pass' : 'failed';
                }
            }
        }

        nextState = { ...nextState, ...accumulatedProps }

        if (nextState.required) {

            const ret = required(type, update.value);

            // console.log(id, ret, ruleTest)

            nextState.error = hasError || ret.error;

            if (ret.message) message.push(ret.message);
            ruleTest.required = ret.error ? 'failed' : 'pass';
        }

        if (nextState.disabled) {
            nextState.error = false;
        }

        nextState.message = message;
        return [Object.assign({ rules }, nextState), ruleTest];
    }


    setField(id: string, update: any, track?: Set<string>) {

        track = track || new Set<string>()
        track.add(id)

        const fieldSchema = this.getSchema(id);

        if (!fieldSchema) {
            console.error(`${id} is not registered`);
            return;
        }

        const typesApi = fieldTypesMap.get(fieldSchema.type)

        if (!typesApi) {
            console.error(`${fieldSchema.type} not exist in config`);
            return;
        }

        if (typeof update === 'function') {
            update = update(this.getField(id) ?? {});
        } else {
            const field = this.getField(id) ?? {};
            update = { ...field, ...update };
        }

        if ("value" in update) {
            const isValid = typesApi.checkValue(update.value)
            if (!isValid) {
                // se il valore in ingresso non e del tipo previsto viene settato al valore iniziale
                console.warn('[createForm]', id, 'invalid value', update.value)
                update.value = typesApi.initValue()
            }
        }

        const [nextState, ruleTest] = this.applyRules(id, update as FieldState);

        const values = this._get()[$VALUES];

        values[id] = typesApi.convert(update.value);

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
                // avoid infinite recursion loop
                if (!track.has(dep)) {
                    this.setField(dep, {}, track);
                }

            }
        }
    }

    get() {
        return this._get()[$VALUES];
    }

    set(id: string, value: any) {
        this.setField(id, { value });
    }

    register(id: string, config?: FieldSchema) {

        if (!config) {
            console.error(`[createForm] - ${id} is not registered`)
            return
        }

        if (!config.type) {
            console.error(`[createForm] - register(${id}, { type: 'is required' })`);
            return;
        }

        const typeApi = fieldTypesMap.get(config.type)

        if (!typeApi) {
            console.error(`[createForm] - type ${config.type} not exist in config`);
            return;
        }

        config = {
            ...config,
            value: typeApi.initValue(config?.value)
        }

        if (config.deps) {
            const deps = new Set(config.deps)
            deps.delete(id)
            config.deps = [...deps]
        }

        this._set((prev: any) => {
            const schema = prev[$SCHEMA] as Record<string, FieldSchema>;
            const values = prev[$VALUES];

            schema[id] = config;
            values[id] = config.value;

            delete prev[id]

            return {
                ...prev,
            };
        });

        this.setField(id, {
            value: config.value,
            disabled: config.disabled,
            required: config.required
        });
    }

    setState(update: FormStateUpdate, replace?: boolean) {
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
        this._set(() => clone(this._initialState))
    }

    getDeps(id: string) {
        return this._get()[$FIELD_DEPS][id];
    }

    _setDeps(id: string, target: string, deps: Set<string>) {

        const CURR_DEPS_ID = `$$${id}`;

        const field_deps = this._get()[$FIELD_DEPS];

        if (!field_deps[target]) {
            field_deps[target] = new Set();
        }

        field_deps[target].add(id)

        field_deps[CURR_DEPS_ID] = deps;
        this._set({ [$FIELD_DEPS]: { ...field_deps } });
    }

    _interceptDeps(id: string) {

        const schema = this.getSchema(id)!

        if (schema.deps) return this.get()

        const deps = this.getDeps(id) ?? new Set();
        const setDeps = this._setDeps.bind(this)

        return new Proxy(this.get(), {
            get(t, targetID: string, r) {

                if (targetID !== id) deps.add(targetID);

                setDeps(id, targetID, deps)
                return Reflect.get(t, targetID, r);
            }
        });

    }


    cleanDeps(id: string) {

        const CURR_DEPS_ID = `$$${id}`
        const map = this._get()[$FIELD_DEPS];
        const depsToClean = map?.[CURR_DEPS_ID];

        if (depsToClean) {
            for (const dep of depsToClean) {
                if (map[dep]) map[dep].delete(id);
            }
            delete map[CURR_DEPS_ID];
            this._set({ [$FIELD_DEPS]: { ...map } });
        }
    }

    watch(
        to: 'values' | 'valid' | 'errors' | 'has_errors',
        callback: (state: any, prevState: any) => void
    ) {
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

    map(fn: (field: FieldState & { id: string }) => Partial<FieldState>, pre_register?: boolean) {

        // console.log('map called')
        const schema = this.getSchema()

        for (const id of Object.keys(schema)) {

            const currState = Object.assign(this.getField(id) ?? {}, { id });
            const ret = fn(currState) as FieldState & { id: string };
            const { id: _, ...nextState } = ret;

            if (pre_register) {
                // keep init values
                this.register(id, {
                    ...schema[id],
                    value: nextState.value
                })
            }

            this.setField(id, nextState);
            // console.log(id, nextState)
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



type StoreApi = { [K in keyof StoreMethods]:
    K extends `_${string}` ? unknown : StoreMethods[K]
}


export type FormControl = StoreApi & {
    (selector?: (state: Record<string, FieldState>) => void): FieldState,
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
                    value: (config as FieldSchema)?.value ?? fieldTypesMap.get(config.type)?.initValue()
                }

                const { value } = state[id]
                state[$VALUES][id] = value
            }

            // console.log('initial data', state)
        }

        new StoreMethods(_set as any, _get, _api, state as any)

        return state
    })) as unknown as FormControl

    const getters = formState.getFormState()



    const methods = new Proxy(
        Object.assign(
            _formMethods<Schema<S>, Values<S>>(formState),
            _hookMethods<{ [K in keyof S]: ReturnType<S[K]> }>(formState),
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