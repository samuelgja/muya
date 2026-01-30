import { GlobalRegistrator } from '@happy-dom/global-registrator'

GlobalRegistrator.register()

// Configure React 19 test environment to suppress act() warnings
// @ts-expect-error - React 19 global flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true
