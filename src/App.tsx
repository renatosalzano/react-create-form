
import { createForm, Control } from "lib/createForm"
import { useEffect, useState } from "react"
import { store } from "./examples/store"
import { Input } from "lib/components/inputs/Input"
import { Checkbox } from "lib/components/inputs/Checkbox"

const form = createForm({
    a: {
        type: String,
        deps: ['a', 'b', 'pippo'],
        rules: {
            test(value, deps) {
                console.log(deps.b)
                return deps.b < 100
            }
        },
        disabled: true
    },
    b: { type: Number },
    Bool: { type: Boolean },
    Check: { type: String }
})




export const App = () => {


    // const values = form.useValues()
    // const expansiveUpdate = form.useValues()
    // const { a, wrong, pippa } = form.useValues()
    const a = form.useValues(state => state.a)
    const values = form.useValues()

    const [state, setState] = useState(true)
    const [value, setValue] = useState<Record<string, any>>({})

    useEffect(() => {
        try {

            form.init({
                a: { value: "pippa", disabled: true },
                b: 1,
            })


            // form.init({
            //     a: { disabled: true },
            // })

            // form.validate()

        } catch (e) {
            console.error(e)
        }

        store.getState().getData()

    }, [])


    return (
        <div className="flex flex-col gap-3 p-4">
            app

            <div className="flex flex-col">

                {Object.entries(values).map(([id, value]) => (
                    <div key={id} className="flex gap-2">
                        <strong>{id}</strong>
                        <span>{value}</span>
                    </div>
                ))}
                {/* <div className="flex gap-2">
                    <strong>A:</strong>
                    <span>{a}</span>
                </div> */}
            </div>

            <button
                className="p-2"
                onClick={() => {
                    console.log(form.get())
                }}
            >
                check
            </button>

            <button
                className="p-2"
                onClick={() => setState(p => !p)}
            >
                {state ? "on" : "off"}
            </button>

            {state && <Control
                id="a"
                control={form.control}
                input={(props) => (
                    <Input
                        {...props}
                        label="A"
                    />
                )}
            />}
            <Control
                id="b"
                control={form.control}
                input={(props) => (
                    <Input
                        {...props}
                        label="B"
                        type="number"
                    />
                )}
            />
            <Control
                id="Bool"
                control={form.control}
                input={(props) => (
                    <Checkbox
                        {...props}
                        label="B"
                    />
                )}
            />
            <Control
                id="Check"
                control={form.control}
                input={(props) => (
                    <Checkbox
                        {...props}
                        label="Check"
                        value="test"
                    />
                )}
            />
            {/* <Control
                id="pippo"
                control={form.control}
                register={{
                    type: String,
                    rules: state
                        ? { test0(v, d) { d.a } }
                        : { test1(v, d) { d.b } }
                }}
                input={(props) => (
                    <input type="datetime-local" {...props} />
                )}
            /> */}
            {/* <Control
                id="error"
                input={(props) => (
                    <input {...props} />
                )}
            /> */}
        </div>
    )
}