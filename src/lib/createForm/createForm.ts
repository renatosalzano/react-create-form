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
type CleanDeps = (id: string) => () => void

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
    cleanDeps: CleanDeps
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
        private _api: any,
        private _defaultState: any
    ) {
        // Autodiscovery: prende tutti i metodi definiti nella classe 
        // e li inietta nell'API di Zustand automaticamente.
        const prototype = Object.getPrototypeOf(this);
        const methodNames = Object.getOwnPropertyNames(prototype);

        for (const key of methodNames) {
            if (key !== 'constructor' && !(key.startsWith('_')) && typeof (this as any)[key] === 'function') {
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

        nextState.error = false;
        nextState.disabled = false

        if (rules) {
            for (const [name, rule] of Object.entries(rules)) {

                const ret = rule(update.value, this._interceptDeps(id));

                if (typeof ret === 'object') {

                    if (ret.message) message.push(ret.message);

                    nextState = {
                        ...nextState,
                        ...ret as any,
                        disabled: nextState.disabled || ret?.disabled,
                        error: nextState.error || ret?.error
                    };

                    ruleTest[name] = ret.error ? 'failed' : 'pass';
                } else {
                    const valid = ret;
                    nextState.error = nextState.error || !valid;
                    ruleTest[name] = valid ? 'pass' : 'failed';
                }
            }
        }

        if (nextState.required) {

            const ret = required(type, update.value);

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


    setField(id: string, update: any, track?: Set<string>) {

        track = track || new Set()
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

    register(id: string, config: FieldSchema) {

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

        this._set(this._defaultState, true)
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

            const currState = Object.assign(this.getField(id) ?? {}, { id });
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
                    value: (config as FieldSchema)?.value ?? fieldTypesMap.get(config.type)?.initValue()
                }

                const { value } = state[id]
                state[$VALUES][id] = value
            }

            // console.log('initial data', state)
        }

        new StoreMethods(_set as any, _get, _api, state)

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