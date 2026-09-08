/** Avoids resolving optional peer dependencies during type-checking or package import. */
export const importOptional = (specifier: string): Promise<unknown> =>
  new Function('specifier', 'return import(specifier)')(specifier) as Promise<unknown>;
