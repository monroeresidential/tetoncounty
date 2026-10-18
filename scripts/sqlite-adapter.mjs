// Small D1-compatible adapter for local preview and integration tests.
export function adaptDb(database) {
  return {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async first() { return database.prepare(sql).get(...values); },
            async run() { return database.prepare(sql).run(...values); },
          };
        },
      };
    },
  };
}
