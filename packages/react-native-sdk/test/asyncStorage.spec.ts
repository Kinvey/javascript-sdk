import * as AsyncStorage from '../src/storage/asyncStorage';

const DB_NAME = 'TEST_DB';
const TABLE_NAME = 'TEST_TABLE';

afterEach(() => AsyncStorage.clear(DB_NAME, TABLE_NAME));

describe('find()', () => {
  test('should return all docs as an array', async () => {
    const docs = [{ _id: '1' }];
    await AsyncStorage.save(DB_NAME, TABLE_NAME, docs);
    const savedDocs = await AsyncStorage.find(DB_NAME, TABLE_NAME);
    expect(savedDocs).toBeInstanceOf(Array);
    expect(savedDocs).toEqual(docs);
  });
});

describe('count()', () => {
  test('should return number of docs', async () => {
    const docs = [{ _id: '1' }];
    await AsyncStorage.save(DB_NAME, TABLE_NAME, docs);
    const count = await AsyncStorage.count(DB_NAME, TABLE_NAME);
    expect(count).toEqual(docs.length);
  });
});

describe('findById()', () => {
  test('should return undefined if a doc does not exist that matches the id', async () => {
    const docs = [{ _id: '1' }];
    await AsyncStorage.save(DB_NAME, TABLE_NAME, docs);
    const doc = await AsyncStorage.findById(DB_NAME, TABLE_NAME, '2');
    expect(doc).toEqual(undefined);
  });

  test('should return a doc that matches the id', async () => {
    const docs = [{ _id: '1' }];
    await AsyncStorage.save(DB_NAME, TABLE_NAME, docs);
    const doc = await AsyncStorage.findById(DB_NAME, TABLE_NAME, '1');
    expect(doc).toEqual(docs[0]);
  });
});

describe('save()', () => {
  test('should save docs', async () => {
    const docs = [{ _id: '1' }];
    await AsyncStorage.save(DB_NAME, TABLE_NAME, docs);
    const savedDocs = await AsyncStorage.find(DB_NAME, TABLE_NAME);
    expect(savedDocs).toEqual(docs);
  });

  test('should add docs when saving new docs to a table that already contains docs', async () => {
    const docs = [{ _id: '1' }];
    await AsyncStorage.save(DB_NAME, TABLE_NAME, docs);
    const newDocs = [{ _id: '2' }];
    await AsyncStorage.save(DB_NAME, TABLE_NAME, newDocs);
    const savedDocs = await AsyncStorage.find(DB_NAME, TABLE_NAME);
    expect(savedDocs).toEqual(docs.concat(newDocs));
  });

  test('should update docs when saving existing docs to a table that already contains docs', async () => {
    const docs = [{ _id: '1' }];
    await AsyncStorage.save(DB_NAME, TABLE_NAME, docs);
    const updatedDocs = [{ _id: '1', title: 'Kinvey' }];
    await AsyncStorage.save(DB_NAME, TABLE_NAME, updatedDocs);
    const savedDocs = await AsyncStorage.find(DB_NAME, TABLE_NAME);
    expect(savedDocs).toEqual(updatedDocs);
  });
});

describe('removeById()', () => {
  test('should return 0 if a doc does not exist that matches the id', async () => {
    const count = await AsyncStorage.removeById(DB_NAME, TABLE_NAME, '1');
    expect(count).toEqual(0);
  });

  test('should return 1 if a doc does match the id', async () => {
    const docs = [{ _id: '1' }];
    await AsyncStorage.save(DB_NAME, TABLE_NAME, docs);
    const count = await AsyncStorage.removeById(DB_NAME, TABLE_NAME, '1');
    expect(count).toEqual(1);
    const savedDocs = await AsyncStorage.find(DB_NAME, TABLE_NAME);
    expect(savedDocs).toEqual([]);
  });
});

describe('clear()', () => {
  test('should remove all the docs', async () => {
    const docs = [{ _id: '1' }];
    await AsyncStorage.save(DB_NAME, TABLE_NAME, docs);
    await AsyncStorage.clear(DB_NAME, TABLE_NAME);
    const savedDocs = await AsyncStorage.find(DB_NAME, TABLE_NAME);
    expect(savedDocs).toEqual([]);
  });
});
