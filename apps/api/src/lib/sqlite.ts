import fs from "fs";
import path from "path";
import { createRequire } from "node:module";
import {
  ColumnTypeEnum,
  Debug,
  DriverAdapterError,
  type ArgType,
  type ColumnType,
  type ConnectionInfo,
  type IsolationLevel,
  type SqlDriverAdapter,
  type SqlDriverAdapterFactory,
  type SqlQuery,
  type SqlResultSet,
  type Transaction,
} from "@prisma/driver-adapter-utils";

const nodeRequire = createRequire(__filename);
const debug = Debug("prisma:driver-adapter:sql.js");

type SqlValue = string | number | null | Uint8Array;
type Statement = {
  bind(values: SqlValue[]): boolean;
  step(): boolean;
  get(): SqlValue[];
  getColumnNames(): string[];
  free(): boolean;
};
type SqlDatabase = {
  prepare(sql: string): Statement;
  exec(sql: string): Array<{ columns: string[]; values: SqlValue[][] }>;
  getRowsModified(): number;
  export(): Uint8Array;
  close(): void;
};

const SCHEMA = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'user',
  "emailVerified" BOOLEAN NOT NULL DEFAULT 1,
  "otpHash" TEXT,
  "otpExpiresAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE TABLE IF NOT EXISTS "Book" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "author" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'English',
  "description" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "coverUrl" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS "Book_author_idx" ON "Book"("author");
CREATE INDEX IF NOT EXISTS "Book_category_idx" ON "Book"("category");
CREATE UNIQUE INDEX IF NOT EXISTS "Book_title_author_key" ON "Book"("title", "author");
CREATE TABLE IF NOT EXISTS "DownloadLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "bookId" TEXT NOT NULL,
  "userId" TEXT,
  "guestKey" TEXT,
  "ip" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DownloadLog_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DownloadLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "DownloadLog_bookId_idx" ON "DownloadLog"("bookId");
CREATE INDEX IF NOT EXISTS "DownloadLog_createdAt_idx" ON "DownloadLog"("createdAt");
CREATE INDEX IF NOT EXISTS "DownloadLog_guestKey_idx" ON "DownloadLog"("guestKey");
CREATE INDEX IF NOT EXISTS "DownloadLog_userId_idx" ON "DownloadLog"("userId");
CREATE TABLE IF NOT EXISTS "Favorite" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "bookId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Favorite_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Favorite_userId_bookId_key" ON "Favorite"("userId", "bookId");
CREATE TABLE IF NOT EXISTS "LibraryItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "bookId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LibraryItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LibraryItem_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "LibraryItem_userId_bookId_key" ON "LibraryItem"("userId", "bookId");
`;

let activeDatabase: { db: SqlDatabase; file: string } | null = null;

export function execScript(script: string) {
  if (!activeDatabase) throw new Error("Database is not open.");
  activeDatabase.db.exec(script);
  flushDatabase();
}

export function flushDatabase() {
  if (!activeDatabase) throw new Error("Database is not open.");
  const file = activeDatabase.file;
  const bytes = Buffer.from(activeDatabase.db.export());
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const fd = fs.openSync(file, "w");
  try {
    fs.writeSync(fd, bytes);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  const saved = fs.statSync(file);
  console.log(`Saved ${file} (${saved.size} bytes)`);
}

export function fileContains(text: string) {
  if (!activeDatabase) return false;
  return fs.readFileSync(activeDatabase.file).includes(Buffer.from(text));
}

function sqlitePath(databaseUrl: string) {
  const raw = databaseUrl.replace(/^file:/, "");
  if (path.isAbsolute(raw)) return raw;
  return path.resolve(__dirname, "../../prisma", raw.replace(/^\.\//, ""));
}

function columnType(declared: string | undefined): ColumnType | null {
  switch ((declared || "").toUpperCase()) {
    case "INT":
    case "INTEGER":
      return ColumnTypeEnum.Int32;
    case "BIGINT":
      return ColumnTypeEnum.Int64;
    case "REAL":
    case "FLOAT":
    case "DOUBLE":
    case "NUMERIC":
      return ColumnTypeEnum.Double;
    case "BOOLEAN":
      return ColumnTypeEnum.Boolean;
    case "DATETIME":
    case "TIMESTAMP":
      return ColumnTypeEnum.DateTime;
    case "DATE":
      return ColumnTypeEnum.Date;
    case "BLOB":
      return ColumnTypeEnum.Bytes;
    case "TEXT":
      return ColumnTypeEnum.Text;
    default:
      return null;
  }
}

function declaredTypes(db: SqlDatabase) {
  const types = new Map<string, string>();
  const tables = db.exec("SELECT sql FROM sqlite_master WHERE type = 'table' AND sql IS NOT NULL");
  for (const row of tables[0]?.values || []) {
    const sql = String(row[0]);
    for (const match of sql.matchAll(/"([^"]+)"\s+(DATETIME|INTEGER|TEXT|BOOLEAN|REAL|BLOB|NUMERIC|BIGINT)/gi)) {
      types.set(match[1], match[2].toUpperCase());
    }
  }
  const books = db.exec('PRAGMA table_info("Book")');
  for (const row of books[0]?.values || []) {
    if (String(row[1]) === "coverUrl" && !types.has("coverUrl")) types.set("coverUrl", "TEXT");
  }
  return types;
}

function mapArg(arg: unknown, argType: ArgType | undefined): SqlValue {
  if (arg == null) return null;
  if (typeof arg === "bigint") return Number(arg);
  if (typeof arg === "boolean") return arg ? 1 : 0;
  if (typeof arg === "number") return arg;
  if (arg instanceof Uint8Array) return arg;
  if (arg instanceof Date) return arg.getTime();
  if (typeof arg === "string" && argType?.scalarType === "datetime") return new Date(arg).getTime();
  if (typeof arg === "string" && argType?.scalarType === "int") return Number.parseInt(arg, 10);
  if (typeof arg === "string" && (argType?.scalarType === "float" || argType?.scalarType === "decimal")) return Number.parseFloat(arg);
  if (typeof arg === "string") return arg;
  return String(arg);
}

function mapValue(value: SqlValue, type: ColumnType): SqlResultSet["rows"][number][number] {
  if (value == null) return null;
  if (value instanceof Uint8Array) return Array.from(value);
  if (type === ColumnTypeEnum.Boolean) return Number(value) === 1;
  if (typeof value === "number" && type === ColumnTypeEnum.DateTime) return new Date(value).toISOString();
  if (typeof value === "number" && (type === ColumnTypeEnum.Int32 || type === ColumnTypeEnum.Int64) && !Number.isInteger(value)) {
    return Math.trunc(value);
  }
  return value;
}

function inferType(value: SqlValue | undefined): ColumnType {
  if (typeof value === "number") return Number.isInteger(value) ? ColumnTypeEnum.Int32 : ColumnTypeEnum.Double;
  if (value instanceof Uint8Array) return ColumnTypeEnum.Bytes;
  if (typeof value === "string") return ColumnTypeEnum.Text;
  return ColumnTypeEnum.Int32;
}

function driverError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  let payload: ConstructorParameters<typeof DriverAdapterError>[0];
  if (message.includes("UNIQUE constraint failed")) {
    const fields = message.split("constraint failed: ")[1]?.split(", ").map((field) => field.split(".").pop() || field);
    payload = { kind: "UniqueConstraintViolation", constraint: fields ? { fields } : undefined, originalCode: "SQLITE_CONSTRAINT_UNIQUE", originalMessage: message };
  } else if (message.includes("NOT NULL constraint failed")) {
    const fields = message.split("constraint failed: ")[1]?.split(", ").map((field) => field.split(".").pop() || field);
    payload = { kind: "NullConstraintViolation", constraint: fields ? { fields } : undefined, originalCode: "SQLITE_CONSTRAINT_NOTNULL", originalMessage: message };
  } else if (message.includes("FOREIGN KEY constraint failed")) {
    payload = { kind: "ForeignKeyConstraintViolation", constraint: { foreignKey: {} }, originalCode: "SQLITE_CONSTRAINT_FOREIGNKEY", originalMessage: message };
  } else if (message.startsWith("no such table")) {
    payload = { kind: "TableDoesNotExist", table: message.split(": ")[1], originalCode: "SQLITE_ERROR", originalMessage: message };
  } else {
    throw error;
  }
  throw new DriverAdapterError(payload);
}

class SqlJsQueryable {
  provider = "sqlite" as const;
  adapterName = "sql.js";

  constructor(
    protected readonly client: SqlDatabase,
    protected readonly types: Map<string, string>,
  ) {}

  async queryRaw(query: SqlQuery): Promise<SqlResultSet> {
    debug("[js::queryRaw] %O", query);
    try {
      const result = this.perform(query);
      const columnTypes = result.names.map((name, index) => columnType(this.types.get(name)) ?? inferType(result.rows.find((row) => row[index] != null)?.[index]));
      return {
        columnNames: result.names,
        columnTypes,
        rows: result.rows.map((row) => row.map((value, index) => mapValue(value, columnTypes[index]))),
      };
    } catch (error) {
      driverError(error);
    }
  }

  async executeRaw(query: SqlQuery): Promise<number> {
    debug("[js::executeRaw] %O", query);
    try {
      const changes = this.perform(query).changes;
      flushDatabase();
      return changes;
    } catch (error) {
      driverError(error);
    }
  }

  protected perform(query: SqlQuery) {
    const statement = this.client.prepare(query.sql);
    try {
      const args = query.args.map((arg, index) => mapArg(arg, query.argTypes[index]));
      if (args.length > 0) statement.bind(args);
      const names = statement.getColumnNames();
      const rows: SqlValue[][] = [];
      while (statement.step()) rows.push(statement.get());
      return { names, rows, changes: this.client.getRowsModified() };
    } finally {
      statement.free();
    }
  }
}

class SqlJsTransaction extends SqlJsQueryable implements Transaction {
  readonly options = { usePhantomQuery: false };

  constructor(
    client: SqlDatabase,
    types: Map<string, string>,
    private readonly unlock: () => void,
  ) {
    super(client, types);
  }

  async commit() {
    this.finish("COMMIT");
    this.unlock();
    flushDatabase();
  }

  async rollback() {
    this.finish("ROLLBACK");
    this.unlock();
  }

  private finish(sql: "COMMIT" | "ROLLBACK") {
    try {
      this.client.exec(sql);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("no transaction")) throw error;
    }
  }
}

class SqlJsAdapter extends SqlJsQueryable implements SqlDriverAdapter {
  private queue: Promise<void> = Promise.resolve();

  constructor(client: SqlDatabase, types: Map<string, string>) {
    super(client, types);
  }

  private exclusive<T>(action: () => Promise<T>): Promise<T> {
    const run = this.queue.then(action, action);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  override queryRaw(query: SqlQuery) {
    return this.exclusive(() => super.queryRaw(query));
  }

  override executeRaw(query: SqlQuery) {
    return this.exclusive(async () => {
      const changes = await super.executeRaw(query);
      flushDatabase();
      return changes;
    });
  }

  executeScript(script: string) {
    return this.exclusive(async () => {
      try {
        this.client.exec(script);
        flushDatabase();
      } catch (error) {
        driverError(error);
      }
    });
  }

  async startTransaction(isolationLevel?: IsolationLevel): Promise<Transaction> {
    if (isolationLevel && isolationLevel !== "SERIALIZABLE") {
      throw new DriverAdapterError({ kind: "InvalidIsolationLevel", level: isolationLevel });
    }
    let release!: () => void;
    const locked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const previous = this.queue;
    this.queue = locked;
    await previous;
    try {
      this.client.exec("BEGIN");
    } catch (error) {
      release();
      driverError(error);
    }
    return new SqlJsTransaction(this.client, this.types, release);
  }

  getConnectionInfo(): ConnectionInfo {
    return { supportsRelationJoins: true };
  }

  async dispose() {
    flushDatabase();
    this.client.close();
    activeDatabase = null;
  }
}

async function openDatabase(file: string) {
  const initSqlJs = nodeRequire("sql.js") as (config: { locateFile: (name: string) => string }) => Promise<{ Database: new (data?: Uint8Array) => SqlDatabase }>;
  const wasmPath = nodeRequire.resolve("sql.js/dist/sql-wasm.wasm");
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const existing = fs.existsSync(file) && fs.statSync(file).size > 0 ? new Uint8Array(fs.readFileSync(file)) : undefined;
  const db = existing ? new SQL.Database(existing) : new SQL.Database();
  db.exec(SCHEMA);
  for (const statement of [
    `ALTER TABLE "User" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT 1`,
    `ALTER TABLE "User" ADD COLUMN "otpHash" TEXT`,
    `ALTER TABLE "User" ADD COLUMN "otpExpiresAt" DATETIME`,
    `ALTER TABLE "Book" ADD COLUMN "coverUrl" TEXT`,
  ]) {
    try {
      db.exec(statement);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("duplicate column")) throw error;
    }
  }
  activeDatabase = { db, file };
  flushDatabase();
  return db;
}

export function createSqlJsAdapter(databaseUrl: string): SqlDriverAdapterFactory {
  const file = sqlitePath(databaseUrl);
  return {
    provider: "sqlite",
    adapterName: "sql.js",
    async connect() {
      const db = await openDatabase(file);
      return new SqlJsAdapter(db, declaredTypes(db));
    },
  };
}
