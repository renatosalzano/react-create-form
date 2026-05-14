import c from "classnames"

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'full'
type Color = 'primary' | 'ghost' | 'error'

export type CommonProps<T extends string = 'default'> = {
    size?: Size
    color?: Color
    variant?: T
    error?: boolean
}

export const Color = (color: Color = 'primary', error?: boolean) => c(`color--${error ? 'error' : color}`)