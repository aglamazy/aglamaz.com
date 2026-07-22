// Minimal in-memory fake standing in for FirebaseFirestore.Firestore, covering
// only the collection().add()/.doc()/.where().orderBy().get() surface the
// repositories under test use. There's no Firestore emulator available in
// this environment (needs a JVM), so this fake is what makes round-trip
// repository tests runnable here. Shared by any test that needs a real
// repository instance without hitting real infra.
export function makeFakeFirestore() {
  const store = new Map<string, Record<string, unknown>>();
  let nextId = 1;

  function matches(data: Record<string, unknown>, filters: Array<[string, unknown]>) {
    return filters.every(([field, value]) => data[field] === value);
  }

  function makeQuery(name: string, filters: Array<[string, unknown]>) {
    return {
      where(field: string, _op: string, value: unknown) {
        return makeQuery(name, [...filters, [field, value]]);
      },
      orderBy() {
        return this;
      },
      async get() {
        const docs = Array.from(store.entries())
          .filter(([key]) => key.startsWith(`${name}/`))
          .filter(([, data]) => matches(data, filters))
          .map(([key, data]) => ({
            id: key.slice(name.length + 1),
            data: () => data,
          }));
        return { docs };
      },
    };
  }

  return {
    collection(name: string) {
      return {
        ...makeQuery(name, []),
        doc(id: string) {
          const key = `${name}/${id}`;
          return {
            async get() {
              const data = store.get(key);
              return { exists: data !== undefined, id, data: () => data };
            },
            async update(updates: Record<string, unknown>) {
              const existing = store.get(key) || {};
              store.set(key, { ...existing, ...updates });
            },
            async delete() {
              store.delete(key);
            },
          };
        },
        async add(data: Record<string, unknown>) {
          const id = `doc${nextId++}`;
          const key = `${name}/${id}`;
          store.set(key, data);
          return {
            id,
            async get() {
              return { exists: true, id, data: () => store.get(key) };
            },
          };
        },
      };
    },
  };
}
