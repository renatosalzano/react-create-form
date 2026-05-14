import { Children, cloneElement, isValidElement, type FC, type InputHTMLAttributes, type ReactNode } from "react"
import { Label } from "./Label"
import type { CommonProps } from "./_common"

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & CommonProps

type Props = {
    children: ReactNode | ReactNode[]
    value: string
    label?: string
    type?: 'single' | 'multiple'
    size?: 'xs' | 'sm' | 'md' | 'lg' | undefined
    error?: boolean
    disabled?: boolean
    onChange(evt: any): void
}

export const RadioGroup: FC<Props> = ({
    label,
    type = 'single',
    size = 'md',
    value,
    children,
    disabled,
    onChange
}) => {

    return (
        <div className="flex flex-col">

            {label && <Label><strong>{label}</strong></Label>}

            {Children.map(children, (child, index) => {
                if (isValidElement(child)) {

                    const { props } = child as any

                    // if (props.id && props.value)
                    if (!props.id && !props.value) {
                        return child
                    }

                    return cloneElement<InputProps>(child as any, {
                        disabled,
                        checked: value === props.value,
                        size,
                        onChange(evt) {
                            if (evt.target.checked) {
                                // console.log(evt.target)
                                onChange(evt)
                            }

                        }
                    })
                }
                return child
            })}
        </div>
    )
}