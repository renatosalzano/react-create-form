
import type { ChangeEvent } from "react"

export const isInputEvent = (evt: any): evt is ChangeEvent<HTMLInputElement, HTMLInputElement> => {

    if (evt && typeof evt === "object" && "target" in evt) {
        return true
    }

    return false
}