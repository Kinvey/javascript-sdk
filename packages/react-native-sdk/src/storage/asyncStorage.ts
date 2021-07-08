import AsyncStorage from '@react-native-async-storage/async-storage';

async function getTable(dbName: string, tableName: string): Promise<Map<string, any>> {
  const data = await AsyncStorage.getItem(`${dbName}.${tableName}`);
  if (data) {
    return new Map(JSON.parse(data));
  }
  return new Map<string, any>();
}

function setTable(dbName: string, tableName: string, table: Map<string, any>): Promise<void> {
  return AsyncStorage.setItem(`${dbName}.${tableName}`, JSON.stringify([...table]));
}

export async function find(dbName: string, tableName: string) {
  const table = await getTable(dbName, tableName);
  return Array.from(table.values());
}

export async function count(dbName: string, tableName: string) {
  const docs = await find(dbName, tableName);
  return docs.length;
}

export async function findById(dbName: string, tableName: string, id: string) {
  const docs = await find(dbName, tableName);
  return docs.find((doc: any) => doc._id === id);
}

export async function save(dbName: string, tableName: string, docs: any = []) {
  const table = await getTable(dbName, tableName);
  docs.forEach((doc: { _id: string }) => {
    table.set(doc._id, doc);
  });
  await setTable(dbName, tableName, table);
  return docs;
}

export async function removeById(dbName: string, tableName: string, id: string) {
  const table = await getTable(dbName, tableName);
  if (table.delete(id)) {
    setTable(dbName, tableName, table);
    return 1;
  }
  return 0;
}

export async function clear(dbName: string, tableName: string) {
  await AsyncStorage.removeItem(`${dbName}.${tableName}`);
  return true;
}

export async function clearDatabase() {
  await AsyncStorage.clear();
  return true;
}
