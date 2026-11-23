/**
 * Next ships CSS typings, but this project is on the TypeScript 7 compiler,
 * which does not pick them up from the `next` reference the way tsc 5 did.
 * One line here is cheaper than pinning the compiler back.
 */
declare module '*.css';
