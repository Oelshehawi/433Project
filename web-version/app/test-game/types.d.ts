// Type declarations for the test game page
declare module 'react' {
  export function useState<T>(initialState: T | (() => T)): [T, (newState: T | ((prevState: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
}

declare module 'framer-motion' {
  export const motion: any;
  export const AnimatePresence: any;
}

// Fix JSX element type issues
declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

// Component Props
interface RulesScrollProps {
  isVisible: boolean;
  onAnimationComplete: () => void;
} 